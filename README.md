# Tasks API: PINAR HALE KARA, 2024502033

## Run it

    cp .env.example .env
    deno task dev        # API on http://localhost:8000
    deno task test       # all tests
    deno task check      # type-check

## Try it in a browser (given, not graded)

`ui/` is a small React page that calls your API (log in, add, advance and delete tasks).
Start the API first, then in a second terminal:

    deno task ui:install   # once
    deno task ui:dev       # UI on http://localhost:5173

The UI uses your routes exactly as described in the handout, so it starts to work as soon
as register, login and the task routes do.

## Design decisions (R8)

Projeyi Deno ortamında Typescriptile ve Hono kullandım. Verileri SQlite\libSQl ile sakladım ve Tabloları Drizzle ile yaptım.Zod ise veri doğrulanmasında kullanıldı.
Veritabanı 3 elementten oluşuyor: users- kullanıcı bilgilerini, sessions- oturum anahtarlarını ve sürelerini, tasks ise görevleri saklıyor. user_id- oturumları ve görevleri kullanıcıya bağlıyor. 
migrate() tabloları ve listelemeyi oluştururdu.
Şifreler bcrypt ile hash şeklinde tutulur ve başarılı her girişte 1 saat geçerli UUID token kullnılır. Kullanılıclar sadece kendi görevlerine ulaşabilir çünkü sorgu sırasında ID kontrolu yapılır.Sql değerleri de parametre olarak gider.
POST görev oluşturur, GET görevleri getirir, PUT ve PATCH mevcut uygulamada kısmi güncelleme yapar, DELETE görevi siler. Beklenen hata yanıtlanrında error ve issues alanları mevcut.
## API with curl (R8)
GET/health
kod:
curl -i http://localhost:8000/health
çıktı:
HTTP/1.1 200 OK
{"ok":true}

Bu sonuç şuan yapmış olduğum çalıştırma sonucunda ortaya çıkmıştır. Tekrar çalıştırılırsa ID ve zaman değişebilir.

POST /auth/register
kod:
curl -i -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"readme-demo@example.com","password":"Test12345!"}'
çıktı:
  HTTP/1.1 201 Created
{"message":"registered successfully"}

POST /auth/login
kod:
curl -i -X POST http://localhost:8000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Finish assignment 5","description":"Complete the README and tests","status":"todo","priority":2}'

çıktı:
HTTP/1.1 201 Created
{"id":1,"user_id":2,"title":"Finish assignment 5","description":"Complete the README and tests","status":"todo","priority":2,"created_at":1795522081}


GET /api/tasks
kod:
curl -i http://localhost:8000/api/tasks \
  -H "Authorization: Bearer $TOKEN"
çıktı:
HTTP/1.1 200 OK
[{"id":1,"user_id":2,"title":"Finish assignment 5","description":"Complete the README and tests","status":"todo","priority":2,"created_at":1795522081}]

GET /api/tasks/1
kod:
curl -i http://localhost:8000/api/tasks/1 \
  -H "Authorization: Bearer $TOKEN"

çıktı:
HTTP/1.1 200 OK
{"id":1,"user_id":2,"title":"Finish assignment 5","description":"Complete the README and tests","status":"todo","priority":2,"created_at":1795522081}

PUT /api/tasks/1
kod:
curl -s -i -X PUT http://localhost:8000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Finish assignment 5","status":"done","priority":2}'

çıktı:
HTTP/1.1 200 OK
{"id":1,"user_id":2,"title":"Finish assignment 5","description":"Complete the README and tests","status":"done","priority":2,"created_at":1795522081}

DELETE /api/tasks/1
kod:
curl -s -i -X DELETE http://localhost:8000/api/tasks/1 \
  -H "Authorization: Bearer $TOKEN"
çıktı:
HTTP/1.1 204 No Content 
""""""Yanıt boş


## My own log (R8)

1- "Command 'deno' not found, did you mean:"
Ubuntu terminalinde Denoyu kurup , sürümünü kontrol ettim.

2-"error: deno task couldn't find deno.json(c) or package.json. See https://docs.deno.com/go/config"
Projenin içinde olmadığımı fark ettim , cd ile assignment5 in içine girdim.

3-"TS2769 [ERROR]: No overload matches this call.
Argument of type '"userId"' is not assignable to parameter of type 'never'."
Hono Variables tanımına userId: number ekledim.

4-"error: Found 5 not formatted files in 17 files"
deno fmt ile formatları düzelttim ve deno fmt --check ile kontrolü sağladım.

5-"error[jsx-button-has-type]: `button` elements must have a `type` attribute"
6 butona type özelliği ekledim ve Add butonunun form göndermesini sağlamak amacıyla submit olarak ayarladım.

6-"fatal: not a git repository (or any of the parent directories): .git"
git init ile ile local repository oluşturdum.

7-"-bash: !\: event not found"
Rate limit denemesinde fazladan ünlem sebebiyle JSON düzgün gönderilmedi ve hata verdi. Ünlem kaldırılınca sonuç 401 ve 409 cevaplarını verdi.
## Bonuses claimed

Bonus 3: Joins and the N+1 problem
Geçici veritabanında karşılaştırma: 3 ayrı COUNT ve 1 GROUP BY sorgusu.
Sıfır durum GROUP BY örneğinde görünmez; endpoint sıfırları da verir.
sonuç:
NAIVE VERSION:
todo 1
in-progress 0
done 2
Query count: 3
OPTIMIZED VERSION:
[ { status: "done", total: 2 }, { status: "todo", total: 1 } ]
Query count: 1

Bonus 4: Indexes and EXPLAIN
db.ts ve schema.ts içine idx_tasks_user_created indeksi ekledim.
sorgu:
EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE user_id = 2 ORDER BY created_at DESC, id DESC LIMIT 10 OFFSET 0
çıktı:
BEFORE INDEX:
SCAN tasks
USE TEMP B-TREE FOR ORDER BY
AFTER INDEX:
SEARCH tasks USING INDEX idx_tasks_user_created (user_id=?)

Bonus 5: Seed data

terminalde çalışan kod:
deno run -A src/seed.ts file:seed-demo.db
deno run -A src/seed.ts file:seed-demo.db
çıktı:
Users: 2
Tasks: 6

seed-demo.db teslim edilmez; script teslim edilir.


Bonus 15: Rate limit on login

Bellekte Map ile email bazında 60 saniyelik pencere tutulur ve 5 yanlış girişten sonraki istek engellenir. Sunucu yeniden başlarsa sayaç sıfırlanır.
terminalde çalıştırılan kod:
EMAIL="ratetest-$(date +%s)@example.com"
for i in {1..6}; do
  echo "===== Attempt $i ====="
  curl -s -i -X POST http://localhost:8000/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"Wrong12345\"}"
  echo
done
sonuç:
Attempts 1–5: HTTP/1.1 401 Unauthorized
{"error":"invalid credentials","issues":[]}
Attempt 6: HTTP/1.1 429 Too Many Requests
retry-after: 60
{"error":"too many login attempts","issues":[]}

Bonus 20: Git repository
Proje Git kullanılarak GitHub'a yüklendi.
Kaynak kodlar, testler ve README dosyası main dalında bulunmaktadır.

Repository:
https://github.com/heaven78holly/assignment5
