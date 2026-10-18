# StockPilot — đánh giá sẵn sàng giới thiệu và phỏng vấn

Ngày đánh giá: **18/10/2026, Asia/Saigon**. Revision kiểm tra: local và remote `main` cùng ở `312eee9ed383fb293273c989b8a00a4ed43903b6`.

## Kết luận

StockPilot đã đủ chất liệu để đưa vào CV và làm project chính trong buổi trao đổi kỹ thuật cho Junior Backend/Fullstack. Với Middle, project cung cấp các tình huống tốt để chứng minh khả năng sở hữu một workflow, nhưng còn thiếu bằng chứng vận hành, hiệu năng và mức hoàn thiện sản phẩm để tự nó chứng minh năng lực ở cấp đó. Độ sâu backend hiện thuyết phục hơn độ hoàn chỉnh của trải nghiệm vận hành.

Đây là nhận định dựa trên repo và demo, không phải dự đoán kết quả tuyển dụng. Mức sẵn sàng cá nhân còn phụ thuộc vào live coding, nền tảng CS, khả năng giải thích tradeoff và kinh nghiệm thực tế. Các tiêu chí công khai của [Amazon](https://amazon.jobs/content/en/how-we-hire/interview-prep/software-development-topics) và [Microsoft](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing) đều đánh giá những năng lực này ngoài việc trình bày project.

| Mục tiêu                                                   | Nhận định hiện tại                                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| Giới thiệu trên CV/GitHub cho Junior                       | Sẵn sàng; chọn các claim có bằng chứng bên dưới                        |
| Demo có người hướng dẫn                                    | Dùng được; cần chốt phiên bản release và tập dượt trước buổi phỏng vấn |
| Nhà tuyển dụng tự khám phá sản phẩm                        | Còn khoảng trống ở exception queue, sửa Draft, navigation và truy vết  |
| Deep dive Middle Backend                                   | Có nội dung tốt; cần bổ sung số đo và diễn tập vận hành                |
| Khẳng định production-ready hoặc vận hành ở quy mô lớn     | Chưa có đủ bằng chứng                                                  |
| Kết luận ứng viên sẵn sàng vượt vòng kỹ thuật tập đoàn lớn | Không thể suy ra chỉ từ repo                                           |

## Bằng chứng kiểm tra trong lượt này

- Đọc source của tenant transaction, order locks/transitions, idempotency, migrations, CI/deploy, frontend recovery, Overview, Orders, Inventory, Receipts và các kiểm thử liên quan. Đây là review có trọng tâm, không phải security audit toàn bộ hệ thống.
- GitHub MCP xác nhận `main` ở `312eee9`. [CI 39060081766](https://github.com/longhang2004/StockPilot/actions/runs/39060081766) và [CodeQL 39060081879](https://github.com/longhang2004/StockPilot/actions/runs/39060081879) đều thành công trên SHA đó.
- Đọc log CI: contracts **11**, API unit **118**, web unit **51**, API integration **78** test pass. Bốn queue test được bỏ qua trong integration thường rồi **4/4 pass** ở bước pg-boss riêng. Không tính số test queue hai lần.
- E2E remote mới nhất chạy 30 test, kết quả **29 passed + 1 flaky**. Test accessibility desktop timeout tại `loginAs()` khi chờ URL `/app` trong 5 giây ở lần đầu, sau đó qua retry. CI xanh không có nghĩa tất cả test pass ngay lần đầu.
- Coverage remote: **62.94% statements, 56.95% branches** toàn API. Gate 80% branches chỉ áp dụng bốn module chỉ định trong `apps/api/vitest.config.ts:8`.
- Audit dependency, lint, typecheck, build và hai Docker image build đều pass trong CI. Job Docker kiểm tra `Config.User=node`; nó không chạy browser acceptance trên production image.
- Trình duyệt thật: landing → Manager demo login → Overview → Orders → mở Draft `SO-2026-1001` thành công trên viewport hẹp của in-app browser. Draft có Confirm/Cancel, không có Edit; URL vẫn `/app/orders`. Không tạo/sửa/confirm đơn hay thay đổi stock để thực hiện audit.
- HTTP công khai: API `/v1/health/live`, `/v1/health/ready` và web proxy `/api/v1/health/live` đều trả **200**. API báo revision **`195e8535c9420213b56d7e84733a1eaa56e912cc`**, database `ok`, queue `not_configured`. Các request đơn lẻ này không phải benchmark.
- [Render deploy 39060556805](https://github.com/longhang2004/StockPilot/actions/runs/39060556805) thất bại ở `Check deployment secrets`: thiếu `RENDER_DEPLOY_HOOK_URL`. Migration, seed và trigger rollout của run này đều chưa chạy. Phiên bản API hiện tại vẫn hoạt động; không suy ra demo bị down từ deploy failure.
- Chưa xác nhận revision riêng của web hoặc cấu hình dashboard Vercel/Render. Health qua web proxy chỉ xác nhận revision của API.
- WSL chạy được khi dùng quyền thực thi phù hợp. Docker daemon local không kết nối được trong lượt này; không khởi động lại Docker, không chạy lại full local suite. Kết quả CI ở trên được kiểm tra trực tiếp qua jobs/logs của đúng SHA.

## Những điểm đã đủ sức làm nội dung phỏng vấn

1. **Dữ liệu và concurrency có miền nghiệp vụ cụ thể.** Confirm/fulfill/cancel khóa order trước và khóa balance theo thứ tự product ID, cập nhật reservation, ledger và audit trong transaction. Có test concurrent confirmations và edit/confirm có barrier. Nguồn: `apps/api/src/orders/order-transition.service.ts:26`, `apps/api/test/orders.integration.spec.ts:206`.
2. **Tenant isolation có nhiều lớp.** Tenant context dùng `set_config(..., true)` trong transaction; migrations FORCE RLS và hạn chế UPDATE/DELETE ledger. Có kiểm thử bằng runtime role. Nguồn: `apps/api/src/database/tenant-database.ts:15`, `apps/api/test/tenant-isolation.integration.spec.ts:120`, `apps/api/prisma/migrations/20260804110000_add_catalog_inventory/migration.sql:66`.
3. **Retry được xử lý xuyên suốt UI và server.** Advisory lock, fingerprint và response lưu cùng transaction; client giữ payload/key khi chưa biết kết quả, có giới hạn tuổi recovery. E2E kiểm tra mất response sau commit. Nguồn: `apps/api/src/idempotency/idempotency.ts:28`, `apps/web/hooks/use-command-mutation.ts:19`, `tests/e2e/command-recovery.spec.ts:5`.
4. **Background processing có bằng chứng thật.** Queue regression dùng PostgreSQL/pg-boss cho mất enqueue, restart, worker/manual retry, backoff và dead-letter. Live queue hiện chưa bật; pending-job lookup và enqueue chưa atomic, không hứa exactly-once queue insertion. Nguồn: `apps/api/test/integration-queue.integration.spec.ts:213`, implementation-status ngày 17/10.
5. **Frontend đã có nền tảng sản phẩm.** Semantic tokens, IBM Plex, responsive table/card, loading/error/empty states, bảo vệ form bẩn, remote catalog search và recovery intent. Nguồn: `apps/web/app/styles/foundation.css`, `apps/web/features/shared/catalog-search.tsx`, `apps/web/components/ui/`.

## Việc cần ưu tiên

### P0 — Chốt release demo và làm lời giải thích chính xác

**Release:** cấu hình deploy hook qua nơi quản lý secret, hoàn tất rollout có gate, xác minh API/web revision và chạy smoke trên release được chọn. Bổ sung post-deploy readiness/revision check có timeout vào workflow; hiện workflow kết thúc sau POST hook (`.github/workflows/deploy-render.yml:78`). Diễn tập rollback ứng dụng và restore database trên môi trường tách biệt, ghi lại kết quả. Không suy ra các bước này đã hoàn thành từ runbook.

**Tài liệu phỏng vấn riêng:** review trước khi học hoặc chia sẻ. File `STOCKPILOT_TECHNICAL_INTERVIEW_GUIDE.md` hiện là untracked và được giữ nguyên. Một số câu cần sửa:

| Vị trí   | Khẳng định hiện tại                                                      | Cách giải thích chính xác hơn                                                                                                                                     |
| -------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dòng 759 | Composite index cho `O(1)` balance locking                               | B-tree lookup thường mô hình hóa là `O(log N)`; thời gian lấy lock còn có thời gian chờ cạnh tranh                                                                |
| Dòng 726 | Sorted product IDs là bảo đảm toán học không còn cyclic wait             | Thứ tự nhất quán ngăn chu trình cho tập tài nguyên tuân thủ cùng thứ tự; chưa chứng minh mọi đường ghi và mọi loại lock đều không thể deadlock                    |
| Dòng 737 | Client disconnect khiến transaction rollback ngay                        | Mất kết nối browser/API không đồng nghĩa kết nối API/database bị đóng hay transaction bị hủy; server có thể đã commit. Đây chính là lý do cần recovery idempotent |
| Dòng 743 | Read-only switch lập tức làm readiness 503 và instance rời load balancer | Readiness hiện chỉ `SELECT 1`, có thể pass trên read-only DB; Render blueprint dùng `/health/live`. Không có bằng chứng tự loại khỏi traffic theo readiness       |
| Dòng 780 | RLS luôn dùng index và không scan dữ liệu tenant khác                    | RLS bảo vệ kết quả truy cập; planner chọn access path. Dùng `EXPLAIN (ANALYZE, BUFFERS)` với runtime role để chứng minh hiệu năng                                 |

Đối chiếu với [PostgreSQL locking](https://www.postgresql.org/docs/current/explicit-locking.html), [index types](https://www.postgresql.org/docs/current/indexes-types.html), [EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) và implementation hiện tại. Các hạn chế trên không đồng nghĩa đã tái hiện một lỗi mất dữ liệu.

### P1 — Hoàn thiện ba workflow người dùng thực sự cần

**Exception → xử lý:** Overview cần item cụ thể có SKU/order/delivery, lý do, tuổi và đường dẫn tới thao tác tương ứng. Hiện ba hàng của Priority work queue là số đếm và link tới module (`apps/web/features/overview/overview-workspace.tsx:137`). Nghiệm thu: người dùng xác định và xử lý một ngoại lệ mà không tìm lại đối tượng ở màn khác.

**Draft → sửa → confirm:** tái sử dụng PATCH API đã có cho form sửa Draft; giữ search/status/page/detail trong URL, Back/Forward hoạt động và reload giữ đúng detail. Hiện selectedId/filter chủ yếu ở React state; drawer Draft chỉ có Confirm/Cancel (`apps/web/features/orders/orders-workspace.tsx:40`, `components/order-detail-view.tsx:57`). Thêm thông báo conflict khi Draft đã được xác nhận trong lúc sửa.

**SKU → reservation → chứng từ → audit:** Inventory cần xem đơn nào giữ hàng và movement đến từ receipt/order nào. Receipts hiện hiển thị các movement, chưa có receipt document list/detail, supplier/reference/lines đầy đủ (`apps/web/features/receipts/receipts-workspace.tsx:37`). Nghiệm thu: từ một số tồn kho có thể giải thích con số đó bằng chứng từ nguồn.

**Recovery khi tạo Draft:** `POST /orders` hiện chủ ý không nhận idempotency key, `createDraftOrder()` dùng mutation thông thường (`apps/web/features/orders/api.ts:17`, `components/order-form-drawer.tsx:63`, `apps/api/src/orders/orders.controller.ts:99`). Suy luận từ code: nếu response tạo thành công bị mất, gửi lại có thể tạo Draft thứ hai. Chưa tái hiện trong lượt audit. Nên bổ sung command identity/recovery và test mất response; không mở rộng claim R4 hiện tại thành mọi write đều retry an toàn.

### P2 — Thêm bằng chứng về vận hành, hiệu năng và tính hữu dụng

- Commit một profile production-image browser acceptance chạy được trong CI. Production-image run 30/30 ngày 17/10 là bằng chứng local có ghi nhận, nhưng config tạm đã xóa; CI hiện gọi dev supervisor (`scripts/e2e-server.mjs:125`, `:149`). Điều tra flake dựa trên trace thay vì chỉ tăng retry. Lưu artifact cả khi có flaky test, vì hiện upload chỉ khi job failure.
- Đo trên staging với fixture lớn hơn demo: ví dụ 100k movement, nhiều tenant và một SKU bị cạnh tranh; công bố SHA, tài nguyên, dataset, warmup, concurrency, p95/p99, error rate, throughput và lock wait. Chọn vài query thực để chạy EXPLAIN bằng app role. `docs/performance.md` hiện là smoke baseline 50 request/workload trên fixture nhỏ từ tháng 8, không chứng minh quy mô triệu bản ghi.
- Nhờ một vài người có công việc gần vận hành kho/bán sỉ thử các nhiệm vụ nhận hàng, tìm lý do thiếu tồn và sửa Draft. Ghi bước họ vướng, thời gian hoàn thành và thay đổi sau phản hồi. Audit chưa có bằng chứng pilot người dùng thật.
- Đồng bộ tài liệu: `docs/architecture.md:24` còn mô tả Render auto-deploy và hook tùy chọn, trái `render.yaml:9` và workflow hiện tại; ngày/nguồn ảnh giữa README và `docs/assets/README.md` cũng khác nhau. Lịch sử kiểm thử nên giữ rõ SHA và phân biệt local/remote.
- UI giữ token/font và phong cách công cụ vận hành hiện có. Ưu tiên thứ bậc thông tin, density và thao tác cụ thể. Landing ở viewport khoảng 600px có heading giới hạn `10ch`, xuống nhiều dòng (`marketing.css:916`); có thể rút gọn nội dung/điều chỉnh độ rộng để demo CTA và bằng chứng sản phẩm xuất hiện sớm hơn. Đây là nhận xét từ viewport đã xem, không thay thế visual QA đủ desktop/mobile.

## Tập dượt phần deep dive

Với mỗi câu, nên mở được code/test liên quan và giải thích một giới hạn hoặc phương án thay thế:

1. Hai manager cùng confirm lượng hàng cuối: transaction nào chờ, đọc lại gì, tại sao transaction đơn thuần chưa đủ?
2. Edit Draft đua với confirm: khóa parent order giải quyết interleaving nào?
3. Server commit nhưng client mất response: key/payload nằm ở đâu, reload và hết 24 giờ xử lý thế nào?
4. Tại sao RLS cần runtime role phù hợp và transaction-local context; connection pooling có ảnh hưởng gì?
5. Worker và manual retry cùng chạy: delivery lock bảo vệ gì, queue còn cửa sổ enqueue nào?
6. Một tenant có nhiều movement hoặc một SKU có nhiều người mua: đo bottleneck nào trước, index/cursor có tradeoff gì?
7. Migration thành công nhưng deploy lỗi: app cũ còn tương thích schema không, rollback và restore khác nhau thế nào?
8. Quyết định nào đến từ nhu cầu người dùng; phần nào do bản thân thiết kế, phần nào dùng AI, và đã kiểm chứng bằng gì?

Demo nên tập trung một chuỗi nhận hàng → Draft/confirm → reservation → fulfill → audit và một failure case có test. Thêm case study ngắn về một lỗi đã sửa, cách tái hiện, quyết định sửa và bằng chứng sau sửa. Khả năng giải thích và thay đổi nhỏ ngay trong buổi phỏng vấn là bằng chứng ownership mạnh hơn việc đọc lại một guide dài.

## Thay đổi trong lượt audit

Chỉ thêm báo cáo này. Không sửa implementation, tài liệu phỏng vấn riêng, secret, cấu hình provider hay business data; không commit/push trong lượt đánh giá.
