-- Starter circles. Runs once per database (like every migration), so circles
-- renamed or removed later by admins are never recreated. Edit freely before
-- the first production deploy.
INSERT INTO "circle" ("id", "slug", "name", "description", "visibility", "min_trust_level") VALUES
  (gen_random_uuid()::text, 'lounge', '{"en":"Lounge","zh":"大厅"}', '{"en":"Say hi and chat about anything.","zh":"打个招呼，随便聊聊。"}', 'open', 0),
  (gen_random_uuid()::text, 'questioning', '{"en":"Questioning","zh":"探索中"}', '{"en":"Still figuring things out? You''re welcome here.","zh":"还在探索自己？这里欢迎你。"}', 'open', 0),
  (gen_random_uuid()::text, 'coming-out', '{"en":"Coming Out Support","zh":"出柜互助"}', '{"en":"Share experiences and support each other.","zh":"分享经历，互相支持。"}', 'approval', 1),
  (gen_random_uuid()::text, 'trans', '{"en":"Trans & Non-binary","zh":"跨性别与非二元"}', '{"en":"A moderated space for trans and non-binary members.","zh":"为跨性别与非二元成员设立的审核制空间。"}', 'approval', 1),
  (gen_random_uuid()::text, 'sapphic', '{"en":"Sapphic","zh":"女同与女性向"}', '{"en":"For women and non-binary people who love women.","zh":"爱女性的女性与非二元朋友。"}', 'approval', 1),
  (gen_random_uuid()::text, 'gay-bi-men', '{"en":"Gay & Bi Men","zh":"男同与双性恋男性"}', '{"en":"For gay, bi and queer men.","zh":"男同、双性恋及酷儿男性。"}', 'approval', 1),
  (gen_random_uuid()::text, 'bi-plus', '{"en":"Bi+ & Pan","zh":"双性恋+与泛性恋"}', '{"en":"Bi, pan, and everyone attracted to more than one gender.","zh":"双性恋、泛性恋，以及被不止一种性别吸引的人。"}', 'approval', 1)
ON CONFLICT ("slug") DO NOTHING;
