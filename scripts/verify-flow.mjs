import worker from "../dist/server/index.js";

const calls = [];
const databaseRows = [
  { id: "1", createdAt: "2026-09-13", status: "待匹配", name: "测试车主", phone: "13800000001", role: "owner", gender: "男", age: "31–35", zodiac: "双子座", work: "海淀", home: "海淀清河", pickup: "清河", vehicle: "SUV", seats: 2, note: "", interestsJson: '["摄影","徒步"]' },
  { id: "2", createdAt: "2026-09-13", status: "待匹配", name: "测试伙伴", phone: "13800000002", role: "rider", gender: "女", age: "25–30", zodiac: "天秤座", work: "海淀", home: "海淀清河", pickup: "清河", vehicle: "", seats: 0, note: "", interestsJson: '["摄影"]' }
];
const DB = { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return { async run() { return { success: true }; } }; }, async all() { return { results: databaseRows }; } }; } };
const env = { DB, ADMIN_PASSWORD: "test", ADMIN_SESSION_SECRET: "test-secret" };
const expected = new Map([["/", "homeScreen"], ["/journey", "journeyScreen"], ["/trip", "tripScreen"], ["/signup?role=owner", "formScreen"], ["/signup?role=rider", "formScreen"], ["/submitted", "profileScreen"]]);

for (const [path, screen] of expected) {
  const response = await worker.fetch(new Request(`https://luyouclub.site${path}`), env, {});
  const html = await response.text();
  if (response.status !== 200 || !html.includes(`id="${screen}" class="screen active`)) throw new Error(`Route failed: ${path}`);
}

const script = await worker.fetch(new Request("https://luyouclub.site/club-interactions?v=6"), env, {});
if (script.status !== 200 || !(await script.text()).includes("data-enter-journey")) throw new Error("Interaction script failed");

const form = new FormData();
for (const [key, value] of Object.entries({ name: "测试用户", phone: "13800000000", wechat: "test_wechat", role: "rider", work: "海淀", home: "朝阳", interestsText: "摄影、徒步", depositConfirmed: "yes" })) form.set(key, value);
const submitted = await worker.fetch(new Request("https://luyouclub.site/api/signup-form", { method: "POST", body: form }), env, {});
if (submitted.status !== 303 || submitted.headers.get("location") !== "/submitted" || calls.length !== 1) throw new Error("Form fallback failed");

const loginForm = new FormData();
loginForm.set("password", "test");
const login = await worker.fetch(new Request("https://luyouclub.site/api/admin/login", { method: "POST", body: loginForm }), env, {});
const cookie = login.headers.get("set-cookie").split(";", 1)[0];
for (const tab of ["overview", "matches", "recap", "plan"]) {
  const response = await worker.fetch(new Request(`https://luyouclub.site/admin?tab=${tab}`, { headers: { cookie } }), env, {});
  const html = await response.text();
  if (response.status !== 200 || !html.includes('id="admin" class="view active"') || !html.includes(`id="${tab}Panel" class="admin-panel active"`) || !html.includes("测试车主")) throw new Error(`Admin tab failed: ${tab}`);
  if (tab === "overview" && !html.includes('id="peoplePanel" class="admin-panel"')) throw new Error("Overview is missing the member directory");
}

console.log("Verified participant flow, submission, admin login, member data, automatic matching, and action plan.");
