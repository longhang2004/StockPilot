# StockPilot — audit khả năng demo và dùng thật

Ngày kiểm tra: **17/10/2026**. Mục tiêu: portfolio cho Junior/Middle Fullstack và Backend tại Việt Nam và công ty quốc tế.

## Kết luận

StockPilot có nền tảng phù hợp để trở thành project chủ lực. Miền tồn kho/đơn B2B tạo được tình huống kỹ thuật có ý nghĩa: hai người cùng giữ hàng, request mất response, webhook gửi lại, phân quyền và truy vết số liệu. Hướng nâng cấp tốt nhất là hoàn thiện các tình huống này từ UI đến database và vận hành.

**Giữ kiến trúc modular monolith, Next.js + NestJS + PostgreSQL, design tokens và IBM Plex hiện tại.** Chưa có lý do từ audit để đổi stack, tách microservices hoặc thay toàn bộ UI library. Có thể bắt đầu trình bày phần đã làm cho Junior; trước khi dùng cụm từ “production-ready”, cần đóng các gap bên dưới. Một portfolio không tự chứng minh kinh nghiệm làm việc ở cấp Middle; nó có thể cung cấp bằng chứng cho khả năng sở hữu và xử lý một feature trọn vẹn.

## Phạm vi và độ tin cậy của bằng chứng

| Nguồn           | Đã kiểm tra                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local checkout  | HEAD `5265b6fe79e251442251ee8b0a6bd37f6400044a`; đọc code của auth, tenant transaction, orders, inventory, integrations, imports, queue, UI và CI |
| GitHub MCP      | `main` trả SHA `4d192828256baca9898929c072eed5885726e277`; đọc Actions jobs, logs và các PR dependency đang mở                                    |
| Linear MCP      | Project StockPilot, spec/audit 25/09; danh sách issue thuộc project trả rỗng                                                                      |
| Browser thực tế | Landing, Manager login, Overview, Orders/list/detail/new form, Imports; desktop 1440×1000 và mobile 390×844                                       |
| API công khai   | `/v1/health/ready` trả 200, database `ok`, queue `not_configured`                                                                                 |
| Internet        | JD từ nhà tuyển dụng, Carbon, PostgreSQL, Stripe, Render và advisory GitHub                                                                       |

Không sửa business data trên demo; chỉ đăng nhập và mở các màn/form. Không chạy full suite trong lượt audit này: WSL không có Node Linux trong PATH và repo chưa có node_modules. Không dùng pnpm của Windows thay thế môi trường mà người dùng yêu cầu. Các phát hiện concurrency được ghi là **rủi ro suy ra từ code**, cần integration test tái hiện trên database riêng trước khi chốt sửa.

Không suy ra live deployment đang chạy SHA nào từ một health response. Local checkout, remote main và demo là ba nguồn bằng chứng riêng. Working tree có nhiều file báo modified do khác biệt cuối dòng; audit không chuẩn hóa hay ghi đè các file đó.

## Nền tảng nên giữ và đưa vào bài demo

- `TenantDatabase.withTenant()` đặt context bằng `set_config(..., true)` trong transaction: `apps/api/src/database/tenant-database.ts`.
- Order transitions khóa order row, rồi khóa balance theo thứ tự product ID; có test concurrent confirmations: `apps/api/src/orders/order-transition.service.ts:33`, `apps/api/test/orders.integration.spec.ts:201`.
- Append-only ledger, database constraints và RLS trên dữ liệu nghiệp vụ; idempotency dùng advisory transaction lock và fingerprint payload: `apps/api/src/idempotency/idempotency.ts`.
- Cookie session, CSRF, Argon2, RBAC; contract Zod dùng chung và OpenAPI; RFC 9457, trace ID, redacted logs; Docker và các gate CI đã có. Cần chứng minh chúng trên revision chuẩn bị demo.
- UI có semantic primitives, focus trap/restore cho drawer, loading/error/empty states, bảo vệ form bẩn, responsive table/card và giảm motion. Không cần xây lại các nền tảng này.
- Signup, workspace, invitation, membership và Stripe entitlement **đã có**. Không đưa chúng vào backlog dưới tên “xây SaaS từ đầu”.

Audit Linear 25/09 không phải nguồn hiện trạng cuối cùng. Code hiện đã có chart `MovementChart`; migrations cũng **FORCE RLS** cho `organization_invitations` và `organization_subscriptions` (`20260806120000.../migration.sql:43`, `20260806140000.../migration.sql:36`). Nhận định cũ rằng hai bảng đó không FORCE RLS không đúng với checkout đã đọc. Users/sessions/memberships có đường truy cập và kiểm soát riêng; không nên đánh đồng với bảng nghiệp vụ tenant.

## Các việc phải đóng trước khi demo về độ tin cậy

### R1 — Khôi phục CI xanh và gắn deploy với đúng revision đã kiểm tra

**Bằng chứng xác nhận từ GitHub:** [CI của remote main](https://github.com/longhang2004/StockPilot/actions/runs/32563708650) thất bại ở `pnpm audit --audit-level high`. Job `docker-build` pass; migration, unit, integration và E2E ở job verify đều bị skipped. CI xanh trước đó ở SHA `4bc5ddc` không chứng minh cho main hiện tại. Các run Dependabot/CodeQL xanh cũng không thay thế workflow CI.

Log chỉ ra `prisma > @prisma/config > deepmerge-ts`. Local lockfile vẫn có `deepmerge-ts@7.1.5` (`pnpm-lock.yaml:3735`). [Advisory GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) liệt kê bản sửa từ 8.0.0. Đây là dependency của tooling Prisma; audit chưa chứng minh một đường khai thác qua HTTP của ứng dụng. Không nên mô tả nó thành lỗ hổng public API đã được tái hiện.

`render.yaml:8` đặt `autoDeployTrigger: commit`, trong khi workflow deploy sau CI là một đường khác. **Cấu hình repo cho phép deploy trước kết quả CI**; chưa kiểm tra override trong dashboard Render/Vercel.

Nâng cấp parent dependency tương thích, kiểm tra migration/generate/build trước khi chọn override. Giữ security gate. Có thể tách audit và verify thành các job cùng bắt buộc để vẫn thu được kết quả test khi audit fail. Chọn một đường release có gate, gắn web/API với cùng SHA, migration tương thích ngược và post-deploy smoke. Giữ liveness nhẹ để tiết kiệm Neon; thêm readiness có timeout/retry ở release gate.

**Nghiệm thu:** mọi required check xanh trên release SHA; revision xuất hiện trong metadata/log vận hành; deploy không phát hành SHA fail gate; diễn tập rollback và restore trên database tách biệt. Không công bố một kết quả pass cũ như kết quả của release mới.

### R2 — Khóa việc sửa Draft cùng với confirm

**Rủi ro từ code:** `apps/api/src/orders/orders.service.ts:56` đọc status Draft rồi xóa/thay lines và cập nhật order, chưa khóa parent order trước khi kiểm tra status. Trong khi đó `order-transition.service.ts:33` dùng `FOR UPDATE`.

Một interleaving có thể xảy ra: editor đọc Draft; confirmer khóa order và đọc bộ lines cũ; editor chờ khi ghi tiếp; confirmer reserve rồi commit; editor tiếp tục thay lines/subtotal mà không kiểm tra lại trạng thái. Khi đó lines hiện tại có thể lệch lượng đã reserve. Việc “đã có transaction” chưa tự loại bỏ race này. [PostgreSQL giải thích phạm vi row locks](https://www.postgresql.org/docs/current/explicit-locking.html).

**Thay đổi tối thiểu:** edit lấy cùng parent row lock trước khi đọc/kiểm tra Draft; thống nhất thứ tự lock với transition. Chỉ thêm version/optimistic concurrency nếu cần thông báo xung đột giữa hai editor.

**Nghiệm thu:** integration test có barrier điều phối edit-vs-confirm và edit-vs-edit; sau cùng hoặc edit được áp dụng trước reservation, hoặc edit trả conflict. Lines, subtotal, reserved và movement phải nhất quán. Không chỉ dùng hai request chạy Promise.all rồi hy vọng race xuất hiện.

### R3 — Làm retry worker thực sự hoạt động và an toàn khi chạy đồng thời

**Mismatch xác nhận từ code:** `integration.service.ts:83` enqueue `deliveryId: headers.deliveryId` là external ID. `retryQueuedDelivery()` chuyển ID đó cho `retryDeliveryTransaction()`, nhưng hàm này tìm `where: { id, organizationId }` là primary key nội bộ (`integration-delivery.service.ts:19`). Worker có thể không tìm thấy delivery cần retry.

**Rủi ro bổ sung:** retry đọc status trước khi khóa delivery. Hai retry với hai idempotency key khác nhau, hoặc manual retry cùng worker, có thể cùng vượt qua kiểm tra FAILED rồi tạo hai Draft. Lock idempotency theo request key không khóa được mọi cách gọi cho cùng delivery. `void enqueueIntegrationRetry(...)` sau domain transaction còn tạo cửa sổ mất job nếu process chết hoặc enqueue lỗi.

Sửa ID contract; khóa delivery trước khi đọc status và xử lý, dùng chung cho manual/worker. Dùng `IntegrationDelivery` làm durable inbox và có đường quét/resume delivery chưa xử lý khi enqueue thất bại; chỉ thêm outbox riêng khi ranh giới database thực sự đòi hỏi. Không cần Kafka cho nhu cầu hiện tại.

**Nghiệm thu:** dùng PostgreSQL/pg-boss thật trong một test profile riêng: external ID khác UUID, thất bại rồi sửa catalog, hai retry đồng thời, restart worker, enqueue bị gián đoạn, hết retry vào DLQ. Mỗi delivery tạo tối đa một order. Unit test hiện tại của job runner chủ yếu kiểm tra trạng thái queue không cấu hình.

Live readiness hiện là `queue:not_configured`: đó là lựa chọn của free profile. Chỉ giới thiệu automatic retry như tính năng đã kiểm chứng khi có queue-enabled acceptance run.

### R4 — Giữ idempotency key theo thao tác của người dùng

`apps/web/features/inventory/api.ts:16`, `features/receipts/api.ts:11` và `features/orders/api.ts:39` tạo key mới mỗi lần gọi hàm. Khi server đã commit nhưng response mất, bấm lại sẽ thành một command mới. Với adjustment có nguy cơ cộng/trừ tồn thêm lần nữa. Receipt còn unique receipt number bảo vệ khỏi tạo trùng cùng số, nhưng client vẫn không lấy lại được response cũ qua replay; transition có thể trả conflict thay vì phục hồi kết quả.

Tạo key lúc bắt đầu một lần submit có payload cố định, giữ khi retry cùng intent, thay khi thao tác thành công hoặc người dùng chủ động đổi intent/payload. Không tự động retry write với key mới. Draft create hiện chủ ý không idempotent; nên bổ sung nếu muốn recovery an toàn cho luồng tạo đơn. [Stripe mô tả cùng nguyên tắc dùng key để retry sau lỗi kết nối](https://docs.stripe.com/api/idempotent_requests).

**Nghiệm thu:** chủ động làm mất response sau commit trong test; retry chỉ có một adjustment/receipt/order và nhận lại kết quả cũ. UI diễn đạt trạng thái chưa biết kết quả, không mặc định kết luận thất bại.

### R5 — Đồng bộ hợp đồng CSV và vòng đời wizard

- UI và parser hứa 2 MB/5.000 dòng (`imports-workspace.tsx:71`, `product-csv-parser.ts:6`), nhưng preview gửi CSV trong JSON (`features/imports/api.ts`) và JSON body parser có giới hạn `100kb` (`configure-application.ts:21`). Payload lớn hơn ngưỡng transport sẽ bị chặn trước parser CSV.
- Sau preview file A, chọn file B chỉ cập nhật fileName/content, chưa xóa preview cũ (`imports-workspace.tsx:77`). Nút Commit vẫn dùng `preview.id` của A. Đây là một mismatch vòng đời state nhìn thấy từ code, cần E2E kiểm chứng trước sửa.
- Commit thành công chỉ toast; wizard chưa chuyển sang trạng thái hoàn tất và vẫn cho bấm Commit.

Cho import route một transport limit hữu hạn phù hợp, tính cả JSON overhead, đồng bộ validation client/server/proxy. Không tăng giới hạn mọi API vô điều kiện. Xóa preview/commit state khi đổi file; thêm template CSV, preview các giá trị thực, số create/update/skip và trang kết quả rõ ràng.

**Nghiệm thu:** valid CSV 150 KB đi qua HTTP thành công; sát 2 MB và vượt ngưỡng trả kết quả đúng; file A→B không thể commit A dưới tên B; file.text/preview lỗi giữ được đường phục hồi; commit hai lần không tạo thay đổi lặp.

### R6 — Loại bỏ trần 100 bản ghi ở UI

Inventory lấy page 1/100 rồi tìm kiếm bằng filter client (`inventory-workspace.tsx:36–50`). Order/receipt selectors cũng lấy 100 products và customers/suppliers đầu (`order-form-drawer.tsx:35`, `receipt-drawer.tsx:39`). Integrations/receipts chưa có UI pagination đầy đủ. Vì vậy product nằm ngoài trang đầu có thể tồn tại trong database nhưng không chọn được khi làm nghiệp vụ.

Inventory còn tính Available từ các dòng đã tải/lọc và Open alerts từ trang alert đang xem (`inventory-workspace.tsx:93–105`); chọn Resolved có thể làm summary Open alerts thành 0. “SKUs tracked” lại dùng total toàn bộ, khiến phạm vi các chỉ số không thống nhất.

Đưa search/filter/pagination về API đã có; bổ sung server aggregate cho summary có phạm vi rõ. Selector tìm SKU/partner bằng truy vấn có giới hạn và hỗ trợ keyboard. Không tải toàn bộ catalog về browser. Chỉ thêm virtualization khi kích thước dữ liệu render thực tế chứng minh cần.

**Nghiệm thu:** fixture riêng có ít nhất 250 products, hơn 100 partners/movements/deliveries; tìm và chọn được product ở trang sau; số summary khớp SQL; có count, pagination, empty vì filter và empty vì chưa có dữ liệu riêng biệt.

## UI/UX nên nâng cấp thế nào

### Giữ diện mạo; hoàn thiện công việc mà người dùng đang làm

Hiện tại có phong cách quiet industrial nhất quán: nền ấm, sidebar tối, terracotta, IBM Plex, bảng có số canh phải và status tiết chế. Đó là tài sản nên giữ. Không cần một đợt redesign chỉ để giống landing SaaS phổ biến.

Chọn [Carbon Data Table](https://carbondesignsystem.com/components/data-table/usage/) làm tài liệu đối chiếu cho toolbar, search, sort, pagination, loading và row actions. Áp dụng behavior/spec vào primitives hiện có. Polaris hữu ích để nghiên cứu merchant workflow, nhưng tài liệu hiện chuyển sang Shopify web components theo platform; không nên hiểu là cần chuyển cả app độc lập sang Polaris.

| Màn/luồng     | Hiện trạng cụ thể                                                                                                                                 | Nâng cấp có ích                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview      | Priority queue là ba dòng count, trùng summary; panel bị kéo cao theo tám stock movements, để nhiều khoảng trống                                  | Hàng đợi là các exception thực: đơn nào đang chờ, SKU nào thiếu, delivery nào lỗi; mỗi item dẫn đúng đối tượng và action. Panel tự cao theo nội dung        |
| Demo guide    | “Confirm and reserve inventory” dẫn sang `/app/inventory`, nơi không có Confirm (`demo-quick-guide.tsx:14`)                                       | Dẫn vào đúng Draft được chọn; cùng một order xuyên suốt hướng dẫn, sau action cho thấy reserved thay đổi                                                    |
| Orders        | Drawer chỉ có line snapshot, timeline và action; API có update Draft nhưng UI chưa có đường edit                                                  | Edit Draft; Requested / Available / Shortfall theo dòng; lỗi 409 chỉ đúng SKU và cách xử lý. Preflight chỉ hỗ trợ quyết định, server lock vẫn là thẩm quyền |
| Navigation    | selected order nằm trong useState, search/filter chủ yếu không đồng bộ ngược vào URL                                                              | Order detail có URL; giữ query/page/filter khi reload/back/share. Link từ Overview, Inventory và Audit mở được cùng entity                                  |
| Receipts      | Lịch sử là các movement RECEIPT lọc từ 100 movements đầu (`receipts-workspace.tsx:33`)                                                            | List theo chứng từ receipt: số phiếu, supplier, ngày nhận, số dòng; mở chi tiết và đi tới các movement liên quan. Lọc ở server trước pagination             |
| Inventory     | Người xem thấy balance nhưng thiếu đường giải thích số reserved/available                                                                         | Mở SKU → lịch sử movement + các order đang reserve → chứng từ gốc. Đây là nơi thể hiện ledger hữu dụng nhất                                                 |
| Integrations  | HTTP 200 có status FAILED vẫn vào onSuccess; toast luôn “Delivery retry queued.”; drawer giữ object selected cũ (`integrations-workspace.tsx:36`) | Toast theo business result; drawer đọc dữ liệu mới; hiện attempts, lỗi và bước sửa; phân biệt xử lý đồng bộ với queued                                      |
| Import        | Màn đầu không chỉ ra schema và sample; preview chủ yếu liệt kê lỗi                                                                                | Template mẫu, thông tin create/update, cảnh báo thay đổi, kết quả có thể quay lại catalog                                                                   |
| Form sau save | Drawer luôn được mount; form chỉ có defaultValues và onSuccess đóng, chưa reset (`receipt-drawer.tsx:49–79`, `order-form-drawer.tsx:45–75`)       | Reset đúng sau success; lần nhận hàng tiếp theo có số phiếu mới; Cancel/discard phải thực sự bỏ thay đổi hoặc nói rõ đang giữ draft                         |
| Loading/error | Analytics lỗi thì `return null` (`analytics-panels.tsx:14`); lỗi network ở session bị coi như expired (`workspace-shell.tsx:34–44`)               | Panel error có retry; phân biệt 401 với mất mạng/503/cold start; giữ dữ liệu nhập, hiển thị trace ID có thể copy khi cần hỗ trợ                             |

### Mobile: số đo thực tế cần sửa

Trong live New draft drawer tại **390×844**, DOM/computed style trả:

| Control             | Chiều cao | Font   |
| ------------------- | --------- | ------ |
| Customer select     | 36px      | 12px   |
| Product select      | 32px      | 12px   |
| Quantity input      | 32px      | 12px   |
| Save draft / Cancel | 36px      | 12px   |
| Close drawer        | 32px      | 13,5px |

Design system của repo đặt mục tiêu touch >=44px, nhưng rule mobile hiện chủ yếu tăng header/nav/card action; form drawer chưa theo kịp. Đây là lệch với hợp đồng thiết kế và làm thao tác kho khó hơn; **không phải kết luận mọi target này tự động vi phạm WCAG AA**.

Tăng hit area của form/actions lên tối thiểu 44px, input text 16px trên mobile, label có thể đọc được; Quantity/Unit price cần label hiển thị khi table header bị ẩn (`responsive.css:224`). Action chính nên nằm ở footer dễ tới, không che dòng lỗi hoặc bàn phím. Card order có thể gọn hơn để quét được nhiều đơn, nhưng vẫn giữ button đủ lớn. View đã kiểm tra không thấy horizontal overflow; điều đó chưa chứng minh tất cả màn, zoom và nội dung dài đều pass.

Nghiệm thu thêm 375/390/768/1440px, text zoom 200%, keyboard, focus khi dialog lồng dialog, error announcement và reduced motion. Axe hiện chỉ kiểm tra các route giới hạn, chưa chứng minh tương tác của mọi drawer (`tests/e2e/accessibility.spec.ts`).

### Chart và số liệu phải trung thực

Backend chỉ GROUP BY các ngày có movements (`dashboard.service.ts:70–76`), trong khi chart cố định group width chia 14 (`movement-chart.tsx:16`). Live snapshot có accessible label “last 2 days” dù tiêu đề là “Last 14 days”. Zero còn được vẽ tối thiểu 1px. Chưa có trục giá trị/legend màu đủ rõ để tự đọc lượng hàng.

Zero-fill đúng 14 ngày theo timezone thống nhất, label ngày và đơn vị, có số/tooltip truy cập được, giữ table summary đang có. Bổ sung period cho analytics all-time. Nếu chart không giúp quyết định, thu gọn nó sau exception queue; không thêm chart cho đủ diện tích.

## Nâng cấp để một team nhỏ có thể dùng thật

Ưu tiên một pilot có giới hạn rõ: **một kho, một đồng tiền, vài thành viên**, không biến scope thành ERP.

1. **Hoàn thiện tài khoản và lời mời:** xác minh email trước hành vi phụ thuộc danh tính email, reset password bằng token một lần/TTL, revoke session; gửi invitation thật và cho resend/revoke. Hiện raw invitation link được trả một lần để copy, chưa có email transport (`invitation.service.ts`). Đây là integration bên ngoài có ích hơn thêm AI chat vào app.
2. **Đồng tiền và thời gian:** UI hiện hardcode `$`/hai chữ số (`lib/formatters.ts:20` và nhiều feature), ngày theo locale browser; tenant context đã có currency. Cho chọn currency/timezone lúc onboarding, dùng Intl tương ứng, tiền tính bằng Decimal hoặc minor units có giới hạn rõ. Với pilot Việt Nam, dùng VND và dữ liệu tên/SKU tiếng Việt thực tế; không chỉ đổi ký hiệu USD thành ₫. Có thể giữ tiếng Anh cho demo quốc tế, bổ sung bản dịch các luồng chính nếu pilot cần.
3. **Chứng từ dùng được:** receipt/order detail có reference, lịch sử người thao tác và bản in phiếu nhận/packing slip. Chưa cần gọi là hóa đơn thuế; scope kế toán của repo hiện không bao gồm chức năng đó.
4. **Vận hành có bằng chứng:** alert khi readiness lỗi, lỗi 5xx và retry tồn đọng; dùng trace/log/Sentry hiện có. Restore database sang môi trường tách biệt rồi kiểm tra ledger/balance/RLS, ghi thời gian khôi phục thực tế. Không chỉ có checklist runbook.
5. **Dataset dùng thật:** giữ canonical fixture nhỏ cho demo nhanh; thêm seed profile lớn riêng để test search, pagination, import và query plan. Không sửa count fixture hiện tại khiến test unrelated vỡ dây chuyền.

Sau pilot, chỉ chọn **một** mở rộng nghiệp vụ từ nhu cầu đã quan sát: nhận/fulfill từng phần, hàng trả, hoặc purchase order. Partial fulfillment có giá trị kỹ thuật nhưng kéo theo reservation, cancel phần còn lại, ledger và UI; chưa có bằng chứng để làm cả ba ngay.

## Làm portfolio thuyết phục với nhà tuyển dụng

Các JD dưới đây là ví dụ để đối chiếu kỹ năng, không phải khảo sát đại diện thị trường hoặc bảo đảm đang nhận ứng viên từ Việt Nam:

- [Bosch Vietnam — Junior Java Developer](https://jobs.smartrecruiters.com/BoschGroup/744000151526859--eta-3-junior-java-developer-1-3-years-of-experience-) đề cập design/implementation/testing, database và giao tiếp với đồng nghiệp quốc tế. Dùng để đối chiếu nền tảng; stack Java và yêu cầu ngôn ngữ riêng không phải lý do đổi StockPilot sang Java.
- [Vexere — Middle Fullstack, Strong BE](https://careers.vexere.com/jobs/36952/) có nội dung indexed về Node/React, SQL, code quality, unit tests, Linux, Docker/CI và shipping ứng dụng. Trang direct trả 404 lúc kiểm tra; chỉ dùng như mẫu JD lưu trong search index, không khẳng định vị trí đang mở.
- [GHX — Software Engineer II](https://job-boards.greenhouse.io/globalhealthcareexchangeinc/jobs/4733072005) nhấn mạnh REST, relational database, unit/integration tests, debugging và cloud; stack chính là Java.
- [Zero Homes — Junior Full Stack](https://jobs.lever.co/zerohomes/5dd339d2-8b4a-496f-890b-363e75217d39) nhấn mạnh hiểu người dùng, làm trọn sản phẩm, chi tiết UI và shipping. Vị trí có yêu cầu địa lý Denver, không phải ví dụ remote toàn cầu.

Suy luận áp dụng cho portfolio: cần chứng minh **hoàn thành một công việc đúng, giải thích được quyết định và xử lý khi nó thất bại**. Tên level và năm kinh nghiệm không đồng nhất giữa công ty.

| Năng lực     | Bằng chứng nên mở trong buổi demo                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------- |
| Frontend     | Luồng thao tác có URL, form dài trên mobile, validation/409/retry, keyboard và state sau mutation  |
| Backend      | Tranh chấp lượng tồn cuối, transaction rollback, retry cùng key, tenant B không đọc được dữ liệu A |
| SQL          | Invariants, RLS runtime role, query plan trên seed lớn và index được thêm vì phép đo cụ thể        |
| Integration  | Failed delivery → sửa nguyên nhân → retry → một order; token email/invitation thực sự có lifecycle |
| Delivery/ops | CI của release SHA, post-deploy smoke, trace từ UI đến log, một restore drill có kết quả           |
| Ownership    | Case study ngắn: vấn đề, constraint, phương án bỏ qua, tradeoff, đo lại và hạn chế còn lại         |

### Kịch bản demo 6–8 phút sau khi đóng các gap

1. **0:00–0:45:** giới thiệu team bán sỉ một kho, một SKU thiếu; mở đúng exception cần xử lý. Dùng cùng một câu chuyện có customer và order cụ thể.
2. **0:45–2:00:** nhận hàng nhiều dòng; mở chứng từ → movement → balance để thấy số liệu nối được.
3. **2:00–3:15:** confirm order, xem reservation; chạy tình huống hai order tranh lượng còn lại từ script/test staging, giải thích vì sao một request conflict và không có partial write.
4. **3:15–4:15:** chuyển Staff, fulfill trên mobile; một action Manager bị API từ chối trong test; kiểm tra balance và actor trong audit.
5. **4:15–5:30:** chọn một lỗi thật có thể phục hồi: CSV một dòng sai hoặc delivery SKU chưa có. Sửa → retry → thành công, không trùng dữ liệu.
6. **5:30–7:00:** mở một test quan trọng, CI đúng SHA và một log trace. Với Backend role dành thêm thời gian cho SQL/lock; với Fullstack role dành thêm cho form/mobile/error recovery.

One-click role login hiện tạo session mới cùng cookie, nên hai tab trong cùng browser profile không đại diện hai user độc lập. Dùng browser context/profile tách biệt khi minh họa concurrent roles. Public Owner có reset toàn workspace nên có thể gián đoạn lượt xem của người khác; buổi phỏng vấn nên có tenant demo riêng được seed sẵn. Chỉ làm sandbox tự tạo/TTL khi có nhu cầu nhiều người dùng đồng thời.

README nên có hai đường đọc: “Try the product” và “Inspect the engineering”. Giữ walkthrough, thêm video ngắn có phụ đề Anh và một case study trung thực. Ghi rõ phần đã chạy, profile queue bật/tắt, kết quả nào là local, dataset và cấu hình đo. Không dùng số req/s từ 8 sản phẩm như bằng chứng scale production; hiện `docs/performance.md` đã cảnh báo đúng giới hạn này.

## Thứ tự thực hiện và điểm dừng

| Đợt                      | Phạm vi                                                                                                 | Hoàn thành khi                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1 — Demo đáng tin        | R1–R6; sửa toast/preview, form lifecycle, control mobile; guide mở đúng order                           | Release SHA xanh, test race/replay/CSV/250 products pass; demo core flow không có đường cụt                  |
| 2 — Product có thể dùng  | Edit Draft; document/detail links; SKU trace; receipt document; email/auth; currency/timezone cho pilot | Một người dùng mục tiêu tự hoàn thành receipt → order → exception recovery mà không cần tác giả chỉ từng nút |
| 3 — Bằng chứng Middle    | Queue profile thật; crash/restart và restore drill; query plan/load trên dataset riêng; case study Anh  | Có artifact và kết quả tái lập cho từng claim, giải thích được constraint và failure mode                    |
| 4 — Mở rộng theo nhu cầu | Một feature nghiệp vụ được pilot yêu cầu                                                                | Có trigger, người dùng, acceptance criteria và lý do chọn thay vì feature khác                               |

Với mục tiêu sắp ứng tuyển Junior, đợt 1 và một vertical slice hoàn chỉnh của đợt 2 là điểm dừng hợp lý để bắt đầu gửi hồ sơ. Với Middle, ưu tiên chứng minh đợt 3 và ownership, không mở rộng menu cho nhiều.

Chưa nên thêm: microservices/Kubernetes, Redis cho một instance nếu chưa có bottleneck, GraphQL song song REST, chatbot/forecast AI không có dữ liệu đánh giá, dashboard nhiều KPI, multi-warehouse trước nhu cầu, hoặc viết lại toàn bộ UI bằng một design system mới. Một bản deploy ổn định, workflow có thể dùng và câu chuyện kỹ thuật kiểm chứng được có giá trị hơn các mục đó.

## Cách chuyển báo cáo sang Linear

Project hiện giữ spec và không có issue triển khai; chưa có thao tác ghi Linear trong lượt audit. Có thể dùng R1–R6 làm sáu issue đầu, giữ nguyên mục nghiệm thu, gắn milestone “Demo đáng tin”. Tách “Product pilot” và “Engineering evidence” thành hai milestone sau; không tạo hàng chục issue framework trước khi chốt pilot.

Tài liệu tham chiếu: [StockPilot trên Linear](https://linear.app/long-hang/project/stockpilot-d49e4aaa98f5), [audit cũ 25/09](https://linear.app/long-hang/document/audit-2026-09-25-hien-trang-va-gap-28c0a5d88986). Các spec hữu ích làm hợp đồng, nhưng mỗi issue cần trích code/revision hiện tại và một check có thể chạy.
