const projectUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;

class RequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function backend(path: string, method = "GET", body?: unknown, token = serviceKey) {
  const response = await fetch(projectUrl + path, {
    method,
    headers: { apikey: serviceKey, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new RequestError(response.status, "Не удалось выполнить запрос.");
  const data = await response.text();
  return data ? JSON.parse(data) : null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (request.method !== "POST") throw new RequestError(405, "Используйте POST.");
    const token = request.headers.get("Authorization")?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) throw new RequestError(401, "Войдите в аккаунт.");
    const actor = await backend("/auth/v1/user", "GET", undefined, token);
    if (actor.app_metadata?.belkhi_role !== "owner" || Date.parse(actor.banned_until) > Date.now()) {
      throw new RequestError(403, "Доступ только для администратора.");
    }

    const input = await request.json().catch(() => null);
    const action = input?.action;
    const page = Number(input?.page ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000) throw new RequestError(400, "Неверная страница.");
    const id = input?.id;
    if (!["accounts", "journal", "overview", "tenders"].includes(action) && (typeof id !== "string" || !uuid.test(id))) {
      throw new RequestError(400, "Неверный идентификатор аккаунта.");
    }
    const list = (account_id: string | null, search_text = "", account_status = "", start_at = 0, role_filter = "all") =>
      backend("/rest/v1/rpc/belkhi_admin_accounts", "POST", { account_id, search_text, account_status, start_at, role_filter });
    const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
    const audit = (type: string) =>
      backend("/rest/v1/belkhi_moderation_log", "POST", { actor: actor.id, target: id, reason, action: type });
    let data;
    if (action === "overview") {
      data = await backend("/rest/v1/rpc/belkhi_admin_overview", "POST", {});
    } else if (action === "tenders") {
      const status = input.status ?? "";
      if (!["", "open", "in_progress"].includes(status)) throw new RequestError(400, "Неверный статус тендера.");
      const customer = input.owner_id ?? null;
      if (customer !== null && (typeof customer !== "string" || !uuid.test(customer))) {
        throw new RequestError(400, "Неверный идентификатор заказчика.");
      }
      data = await backend("/rest/v1/rpc/belkhi_admin_tenders", "POST", {
        search_text: String(input.search ?? "").trim().slice(0, 150), tender_status: status,
        customer_id: customer, start_at: page * 30,
      });
    } else if (action === "tender") {
      data = await backend("/rest/v1/rpc/belkhi_admin_tender", "POST", { tender_id: id });
      if (!data) throw new RequestError(404, "Тендер не найден.");
    } else if (action === "accounts") {
      const status = ["active", "blocked"].includes(input.status) ? input.status : "";
      const role = input.role ?? "all";
      if (!["all", "customers", "specialists", "admins"].includes(role)) throw new RequestError(400, "Неверный раздел аккаунтов.");
      data = await list(null, String(input.search ?? "").trim().slice(0, 150), status, page * 30, role);
    } else if (action === "journal") {
      const target = input.target ?? null;
      if (target !== null && (typeof target !== "string" || !uuid.test(target))) throw new RequestError(400, "Неверный идентификатор аккаунта.");
      const event = input.event ?? "";
      if (!["", "block_requested", "unblock_requested", "read_messages"].includes(event)) throw new RequestError(400, "Неверное действие журнала.");
      const filters = new URLSearchParams({order: "id.desc", limit: "31", offset: String(page * 30)});
      if (target) filters.set("target", "eq." + target);
      if (event) filters.set("action", "eq." + event);
      data = await backend("/rest/v1/belkhi_moderation_log?" + filters);
    } else {
      if (!["account", "block", "unblock", "messages"].includes(action)) {
        throw new RequestError(400, "Неизвестное действие.");
      }
      const [account] = await list(id);
      if (!account) throw new RequestError(404, "Аккаунт не найден.");
      if (action === "account") {
        data = account;
      } else {
        if (reason.length < 3 || reason.length > 500) throw new RequestError(400, "Укажите причину от 3 до 500 символов.");
        if (action === "messages") {
          await audit("read_messages");
          data = await backend("/rest/v1/belkhi_messages?or=(sender_id.eq." + id + ",recipient_id.eq." + id +
            ")&order=id.desc&limit=31&offset=" + page * 30);
        } else {
          if (account.owner || id.toLowerCase() === actor.id) {
            throw new RequestError(403, "Аккаунт администратора защищён от блокировки.");
          }
          await audit(action === "block" ? "block_requested" : "unblock_requested");
          if (action === "block") {
            await backend("/rest/v1/belkhi_account_blocks", "POST", [{ user_id: id }]).catch((error) => {
              if (!(error instanceof RequestError) || error.status !== 409) throw error;
            });
          } else {
            await backend("/rest/v1/belkhi_account_blocks?user_id=eq." + id, "DELETE");
          }
          [data] = await list(id);
        }
      }
    }
    return Response.json(data, { headers });
  } catch (error) {
    if (error instanceof RequestError && error.status < 500) {
      return Response.json({ message: error.message }, { status: error.status, headers });
    }
    return Response.json({ message: "Сервис администрирования временно недоступен." }, { status: 502, headers });
  }
});
