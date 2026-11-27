-- The single settings row (defaults defined on the table). Admins edit it in the console.
INSERT INTO "qa_settings" ("id") VALUES (1) ON CONFLICT ("id") DO NOTHING;
