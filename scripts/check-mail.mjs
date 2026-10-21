import assert from "node:assert/strict";
import { moveMail } from "../convex/mailMove.ts";

function mock(provider, failAt = -1) {
  const calls = [];
  const request = async (path, init) => {
    calls.push({ path, method: init.method, body: init.body ? JSON.parse(init.body) : undefined });
    if (calls.length === failAt) throw new Error("Provider unavailable");
    return { id: "moved-id" };
  };
  const unexpected = async () => { throw new Error("Wrong provider"); };
  return {
    calls,
    request: {
      gmail: provider === "google" ? request : unexpected,
      graph: provider === "microsoft" ? request : unexpected,
    },
  };
}

const google = { provider: "google", externalId: "google:message" };
const microsoft = { provider: "microsoft", externalId: "microsoft:message" };

{
  const m = mock("google");
  assert.equal(await moveMail(google, "Label_123", null, m.request), null);
  assert.deepEqual(m.calls, [{
    path: "messages/message/modify",
    method: "POST",
    body: { addLabelIds: ["Label_123"], removeLabelIds: ["INBOX", "UNREAD"] },
  }]);
}
{
  const m = mock("google");
  await moveMail(google, "TRASH", null, m.request);
  assert.deepEqual(m.calls, [
    { path: "messages/message/modify", method: "POST", body: { removeLabelIds: ["UNREAD"] } },
    { path: "messages/message/trash", method: "POST", body: undefined },
  ]);
}
{
  const m = mock("google");
  await moveMail(google, null, "TRASH", m.request);
  assert.deepEqual(m.calls, [
    { path: "messages/message/untrash", method: "POST", body: undefined },
    { path: "messages/message/modify", method: "POST", body: { addLabelIds: ["INBOX"], removeLabelIds: [] } },
  ]);
}
{
  const m = mock("google");
  await moveMail(google, null, "Label_123", m.request);
  assert.deepEqual(m.calls[0].body, { addLabelIds: ["INBOX"], removeLabelIds: ["Label_123"] });
}
for (const destination of ["folder", "deleteditems"]) {
  const m = mock("microsoft");
  assert.equal(await moveMail(microsoft, destination, null, m.request), "microsoft:moved-id");
  assert.deepEqual(m.calls, [
    { path: "messages/message", method: "PATCH", body: { isRead: true } },
    { path: "messages/message/move", method: "POST", body: { destinationId: destination } },
  ]);
}
{
  const m = mock("microsoft");
  await moveMail(microsoft, null, "deleteditems", m.request);
  assert.deepEqual(m.calls, [
    { path: "messages/message/move", method: "POST", body: { destinationId: "inbox" } },
  ]);
}
for (const email of [google, microsoft]) {
  for (const destination of ["folder", email.provider === "google" ? "TRASH" : "deleteditems"]) {
    const m = mock(email.provider, 1);
    await assert.rejects(moveMail(email, destination, null, m.request), /Provider unavailable/);
    assert.equal(m.calls.length, 1, "Do not move a message if marking it read failed");
  }
}
console.log("Mail sorting, read status, Trash, Undo, and failure checks passed. No real emails were used.");
