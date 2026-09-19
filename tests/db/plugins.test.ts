import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createMigratedDb, createUser, type Db } from "./harness";

const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");

/**
 * Plugins (decisions R7 and R10): Contributors build, moderation reviews and
 * disables, versions are append-only, and nothing about a plugin's state
 * damages the packages built on it.
 */
const SHA = "a".repeat(64);
/** Where a definition file would sit in the store (decision R13): the database only ever holds its key. */
const draftKey = (ownerId: string, pluginRowId: string) => `plugins/${ownerId}/${pluginRowId}-draft.lisanplugin.json`;
const versionKey = (ownerId: string, fileId: string) => `plugins/${ownerId}/${fileId}.lisanplugin.json`;

describe("plugins, versions and publish requests", () => {
  let db: Db;
  let student: string;
  let creator: string;
  let contributor: string;
  let otherContributor: string;
  let moderator: string;
  let admin: string;
  let owner: string;
  let pluginId: string;

  const grant = (userId: string, rank: string) =>
    db.query("insert into public.admin_ranks (user_id, rank) values ($1, $2)", [userId, rank]);
  const createPlugin = (userId: string, slug: string) =>
    asUser(db, userId, async () => {
      const id = crypto.randomUUID();
      const res = await db.query<{ id: string }>(
        "insert into public.plugins (id, plugin_id, owner_id, draft_key, draft_sha256) values ($1, $2, $3, $4, $5) returning id",
        [id, slug, userId, draftKey(userId, id), SHA],
      );
      return res.rows[0].id;
    });
  const submit = (userId: string, pluginRowId: string, version: string, ownerId = userId, note?: string) =>
    asUser(db, userId, () =>
      db.query<{ submit_plugin_version: string }>("select public.submit_plugin_version($1, $2, 1, $3, $4, $5)", [
        pluginRowId,
        version,
        versionKey(ownerId, crypto.randomUUID()),
        SHA,
        note ?? null,
      ]),
    );

  beforeAll(async () => {
    db = await createMigratedDb();
    student = await createUser(db, "student_p");
    creator = await createUser(db, "creator_p");
    contributor = await createUser(db, "contrib_p");
    otherContributor = await createUser(db, "contrib_q");
    moderator = await createUser(db, "mod_p");
    admin = await createUser(db, "admin_p");
    owner = await createUser(db, "owner_p");
    await grant(moderator, "moderator");
    await grant(admin, "administrator");
    await grant(owner, "platform_owner");
    await asUser(db, creator, () => db.query("select public.become_content_creator()"));
    await asUser(db, contributor, () => db.query("select public.become_contributor()"));
    await asUser(db, otherContributor, () => db.query("select public.become_contributor()"));
    pluginId = await createPlugin(contributor, "dialogue-fill");
  });

  it("opens the Contributor path to Students only — never to a Content Creator", async () => {
    await expect(asUser(db, creator, () => db.query("select public.become_contributor()"))).rejects.toThrow(
      /not allowed/,
    );
    const role = await db.query<{ primary_role: string }>("select primary_role from public.profiles where id = $1", [
      contributor,
    ]);
    expect(role.rows[0].primary_role).toBe("contributor");
  });

  it("lets only Contributors (and the owner) create a plugin, always as its owner", async () => {
    for (const [who, label] of [
      [student, "student"],
      [creator, "creator"],
    ] as const) {
      await expect(createPlugin(who, `nope-${label}`)).rejects.toThrow(/row-level security/);
    }
    await expect(
      asUser(db, contributor, () =>
        db.query("insert into public.plugins (plugin_id, owner_id) values ('stolen-one', $1)", [otherContributor]),
      ),
    ).rejects.toThrow(/row-level security|belongs to the account/);
    await expect(createPlugin(owner, "owner-made")).resolves.toBeTruthy();
  });

  it("keeps a draft to its owner and moderation, editable in its draft file columns only", async () => {
    const seenBy = async (userId: string | null) => {
      const query = () => db.query("select id from public.plugins where id = $1", [pluginId]);
      return (userId ? await asUser(db, userId, query) : await asAnon(db, query)).rows.length;
    };
    expect(await seenBy(contributor)).toBe(1);
    expect(await seenBy(moderator)).toBe(1);
    expect(await seenBy(otherContributor)).toBe(0);
    expect(await seenBy(null)).toBe(0);

    await asUser(db, contributor, () =>
      db.query("update public.plugins set draft_sha256 = $2 where id = $1", [pluginId, "b".repeat(64)]),
    );
    // The draft file must stay in the owner's own folder of the store.
    await expect(
      asUser(db, contributor, () =>
        db.query("update public.plugins set draft_key = $2 where id = $1", [
          pluginId,
          draftKey(otherContributor, pluginId),
        ]),
      ),
    ).rejects.toThrow(/owner's folder/);
    for (const change of ["status = 'published'", "disabled = true", "owner_id = owner_id"]) {
      if (change === "owner_id = owner_id") continue;
      await expect(
        asUser(db, contributor, () => db.query(`update public.plugins set ${change} where id = $1`, [pluginId])),
      ).rejects.toThrow(/not editable by the owner/);
    }
    const foreign = await asUser(db, otherContributor, () =>
      db.query("update public.plugins set draft_sha256 = $2 where id = $1", [pluginId, "c".repeat(64)]),
    );
    expect(foreign.affectedRows ?? 0).toBe(0);
  });

  it("queues a Contributor's version for review instead of publishing it", async () => {
    const outcome = await submit(contributor, pluginId, "1.0.0");
    expect(outcome.rows[0].submit_plugin_version).toBe("requested");
    const status = await db.query<{ status: string }>("select status from public.plugins where id = $1", [pluginId]);
    expect(status.rows[0].status).toBe("pending_review");

    await expect(submit(contributor, pluginId, "1.0.1")).rejects.toThrow(/plugin_publish_requests_one_pending_idx/);
    await expect(submit(otherContributor, pluginId, "2.0.0")).rejects.toThrow(/only the owner/);

    const queue = async (userId: string) =>
      (await asUser(db, userId, () => db.query("select id from public.plugin_publish_requests"))).rows.length;
    expect(await queue(moderator)).toBe(1);
    expect(await queue(contributor)).toBe(1);
    expect(await queue(otherContributor)).toBe(0);
  });

  it("lets moderation reject with a reason, and only moderation decide", async () => {
    const request = await db.query<{ id: string }>(
      "select id from public.plugin_publish_requests where status = 'pending'",
    );
    const requestId = request.rows[0].id;
    await expect(
      asUser(db, contributor, () => db.query("select public.review_plugin_publish_request($1, true)", [requestId])),
    ).rejects.toThrow(/moderator rank required/);
    await expect(
      asUser(db, moderator, () => db.query("select public.review_plugin_publish_request($1, false)", [requestId])),
    ).rejects.toThrow(/needs a reason/);
    await asUser(db, moderator, () =>
      db.query("select public.review_plugin_publish_request($1, false, 'contract', 'fields missing')", [requestId]),
    );
    const after = await db.query<{ status: string }>("select status from public.plugins where id = $1", [pluginId]);
    expect(after.rows[0].status).toBe("draft");
    await expect(
      asUser(db, moderator, () => db.query("select public.review_plugin_publish_request($1, true)", [requestId])),
    ).rejects.toThrow(/already decided/);
  });

  it("publishes an approved request as an append-only version readable by everyone", async () => {
    // A file outside the owner's folder is refused before anything is written.
    await expect(submit(contributor, pluginId, "1.0.0", otherContributor)).rejects.toThrow(/does not belong/);
    await submit(contributor, pluginId, "1.0.0", contributor, "first");
    const request = await db.query<{ id: string }>(
      "select id from public.plugin_publish_requests where status = 'pending'",
    );
    const decision = await asUser(db, moderator, () =>
      db.query<{ review_plugin_publish_request: string }>("select public.review_plugin_publish_request($1, true)", [
        request.rows[0].id,
      ]),
    );
    expect(decision.rows[0].review_plugin_publish_request).toBe("approved");

    const plugin = await asAnon(db, () =>
      db.query<{ status: string; current_version_id: string }>(
        "select status, current_version_id from public.plugins where id = $1",
        [pluginId],
      ),
    );
    expect(plugin.rows[0].status).toBe("published");
    const version = await asAnon(db, () =>
      db.query<{ id: string; version_number: number; author_id: string; definition_key: string }>(
        "select id, version_number, author_id, definition_key from public.plugin_versions where plugin_id = $1",
        [pluginId],
      ),
    );
    expect(version.rows).toHaveLength(1);
    expect(version.rows[0].id).toBe(plugin.rows[0].current_version_id);
    expect(version.rows[0].version_number).toBe(1);
    expect(version.rows[0].author_id).toBe(contributor);
    expect(version.rows[0].definition_key).toMatch(
      new RegExp(`^plugins/${contributor}/[0-9a-f-]+\\.lisanplugin\\.json$`),
    );

    await expect(
      asUser(db, contributor, () =>
        db.query("update public.plugin_versions set definition_key = $2 where id = $1", [
          version.rows[0].id,
          versionKey(contributor, "other"),
        ]),
      ),
    ).rejects.toThrow(/permission denied|append-only/);
    await expect(
      asUser(db, contributor, () =>
        db.query(
          "insert into public.plugin_versions (plugin_id, version, schema_version, definition_key, definition_sha256) values ($1, '9.9.9', 1, $2, $3)",
          [pluginId, versionKey(contributor, "forged"), SHA],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(submit(contributor, pluginId, "1.0.0")).rejects.toThrow(/already exists/);
  });

  it("holds no plugin document in the database: files carry definitions, rows carry keys and hashes (decision R13)", async () => {
    const columns = await db.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.columns
        where table_schema = 'public' and table_name in ('plugins', 'plugin_versions', 'plugin_publish_requests')
          and data_type = 'jsonb' order by table_name, column_name`,
    );
    // The only JSON left is the translated kill-switch message: metadata, not a definition.
    expect(columns.rows.map((c) => `${c.table_name}.${c.column_name}`)).toEqual(["plugins.disabled_message"]);
  });

  it("lets the Platform Owner publish directly (plugins.publish)", async () => {
    const ownerPlugin = await db.query<{ id: string }>("select id from public.plugins where plugin_id = 'owner-made'");
    const outcome = await submit(owner, ownerPlugin.rows[0].id, "1.0.0");
    expect(outcome.rows[0].submit_plugin_version).toBe("published");
    const requests = await db.query("select id from public.plugin_publish_requests where plugin_id = $1", [
      ownerPlugin.rows[0].id,
    ]);
    expect(requests.rows).toHaveLength(0);
  });

  it("reserves the kill switch and hiding for moderation, without deleting anything", async () => {
    await expect(
      asUser(db, contributor, () => db.query("select public.set_plugin_disabled($1, null, true)", [pluginId])),
    ).rejects.toThrow(/moderator rank required/);
    await asUser(db, moderator, () =>
      db.query('select public.set_plugin_disabled($1, null, true, \'{"ar": "معطّلة مؤقتًا"}\'::jsonb)', [pluginId]),
    );
    const disabled = await asAnon(db, () =>
      db.query<{ disabled: boolean; versions: number }>(
        "select p.disabled, (select count(*)::int from public.plugin_versions v where v.plugin_id = p.id) as versions from public.plugins p where p.id = $1",
        [pluginId],
      ),
    );
    expect(disabled.rows[0]).toEqual({ disabled: true, versions: 1 });
    await expect(submit(contributor, pluginId, "1.1.0")).rejects.toThrow(/disabled plugin/);
    await asUser(db, moderator, () => db.query("select public.set_plugin_disabled($1, null, false)", [pluginId]));

    const version = await db.query<{ id: string }>("select id from public.plugin_versions where plugin_id = $1", [
      pluginId,
    ]);
    const attempt = await asUser(db, contributor, () =>
      db.query("update public.plugin_versions set disabled = true where id = $1", [version.rows[0].id]),
    );
    expect(attempt.affectedRows ?? 0).toBe(0);
    await asUser(db, moderator, () =>
      db.query("select public.set_plugin_disabled($1, $2, true)", [pluginId, version.rows[0].id]),
    );
    const v = await db.query<{ disabled: boolean }>("select disabled from public.plugin_versions where id = $1", [
      version.rows[0].id,
    ]);
    expect(v.rows[0].disabled).toBe(true);

    await expect(
      asUser(db, contributor, () => db.query("select public.set_plugin_hidden($1, true)", [pluginId])),
    ).rejects.toThrow(/moderator rank required/);
    await asUser(db, moderator, () => db.query("select public.set_plugin_hidden($1, true)", [pluginId]));
    const hidden = await asAnon(db, () => db.query("select id from public.plugins where id = $1", [pluginId]));
    expect(hidden.rows).toHaveLength(1);
    await asUser(db, moderator, () => db.query("select public.set_plugin_hidden($1, false)", [pluginId]));
  });

  it("lets an Administrator return a Contributor to Student after support review", async () => {
    await asUser(db, admin, () => db.query("select public.admin_set_primary_role($1, 'student')", [otherContributor]));
    const role = await db.query<{ primary_role: string }>("select primary_role from public.profiles where id = $1", [
      otherContributor,
    ]);
    expect(role.rows[0].primary_role).toBe("student");
  });

  it("audits every plugin change", async () => {
    const audit = await db.query<{ n: number }>(
      "select count(*)::int as n from public.audit_log where target_table in ('plugins', 'plugin_versions', 'plugin_publish_requests')",
    );
    expect(audit.rows[0].n).toBeGreaterThan(5);
  });

  it("keeps definition bodies out of the audit trail, including snapshots written before they became files", async () => {
    // Every snapshot written by the tests above holds keys and hashes only (the columns are gone).
    const bodies = () =>
      db.query<{ n: number }>(
        `select count(*)::int as n from public.audit_log
         where before ? 'draft' or before ? 'definition' or after ? 'draft' or after ? 'definition'`,
      );
    expect((await bodies()).rows[0].n).toBe(0);
    // A snapshot from before migration 20260919000100 carried the whole definition; the cleanup
    // migration strips it and is safe to run again on any environment.
    await db.query(
      `insert into public.audit_log (action, target_table, target_id, before, after)
       values ('update', 'plugins', $1, $2, $3)`,
      [
        pluginId,
        JSON.stringify({ id: pluginId, status: "draft", draft: { activities: [{ id: "a" }] } }),
        JSON.stringify({ id: pluginId, status: "published", draft: { activities: [{ id: "a" }] } }),
      ],
    );
    expect((await bodies()).rows[0].n).toBe(1);
    await db.exec(readFileSync(join(migrationsDir, "20260919000200_audit_log_without_definition_bodies.sql"), "utf8"));
    expect((await bodies()).rows[0].n).toBe(0);
    const kept = await db.query<{ before: { status: string }; after: { status: string } }>(
      "select before, after from public.audit_log where target_table = 'plugins' and target_id = $1 order by id desc limit 1",
      [pluginId],
    );
    expect(kept.rows[0].before.status).toBe("draft");
    expect(kept.rows[0].after.status).toBe("published");
  });
});
