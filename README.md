# MONGIL Atlas Việt Nam — bản triển khai Netlify có dữ liệu động

**Trang tham chiếu:** https://mongil-atlas-vn.chungndtq001.chatgpt.site/

Bản này là **ứng dụng xây dựng lại dựa trên chức năng và nội dung công khai**, không phải tệp mã nguồn xuất trực tiếp từ ChatGPT Sites. Vì chưa được cung cấp mã nguồn/trang quản trị và ảnh gốc, **không thể cam kết giống 100%** toàn bộ giao diện, dữ liệu kỹ năng, tài nguyên ảnh và hành vi ẩn của trang đang chạy. Để đối chiếu chính xác 1:1, cần mã nguồn (hoặc bản xuất project) của trang gốc.

## 1. Những gì đã được phát triển

| Phần | Người xem | Quản trị |
|---|---|---|
| Nhân vật (29 mục khởi tạo) | Tra cứu, tìm kiếm, lọc nguyên tố/vai trò, xem mô tả/skill | Thêm / sửa / xóa / công bố |
| Build nhân vật | Xem nhân vật, trang bị, Monsterling, Monster Legend, chỉ số, mô tả | CRUD, chọn trang bị và Monsterling trực quan theo hình, ẩn bản nháp |
| Đội hình | Xem bộ 3 nhân vật và cách phối hợp | CRUD, chọn đúng 3 nhân vật |
| Tin chính thức / leak | Tin có tóm tắt ngay trên danh sách, mở chi tiết/nguồn | CRUD, nhập từ nguồn ngoài, duyệt bản nháp |
| Trang bị / Monsterling | Tra cứu tên, ảnh, bộ trang bị, Link/Rank/Traits khi có | CRUD, nhập JSON từ nguồn ngoài |
| Monster Legend | Xem dữ liệu đã được công bố | CRUD, cho phép chỉ định trong build |
| Đã lưu | Yêu thích cục bộ trong trình duyệt | Không cần quyền quản trị |
| Nguồn ngoài | Không lộ cấu hình nguồn | RSS, Atom, JSON, HTML selector; xem thử, đồng bộ thủ công hoặc hằng ngày |
| Sao lưu | — | Xuất/nhập JSON, tùy chọn gộp hoặc thay thế |
| Đăng nhập | Chỉ xem thông tin công khai | Tài khoản mặc định `admin` / `admin`, đổi mật khẩu trong ứng dụng |

**Dữ liệu:** Netlify Functions (API) + Netlify Blobs (lưu lâu dài giữa các bản deploy). Nội dung công khai được tải từ API, không chỉ lưu trong `localStorage`. Các mục cá nhân "Đã lưu" được lưu trên trình duyệt người xem vì không có tài khoản người dùng phổ thông.

**Dữ liệu mẫu:** tên 29 nhân vật, 198 Monsterling, 40 tên trang bị được tham chiếu từ danh mục công khai tháng 10/2026 và 3 tiêu đề tin Netmarble. Các trường kỹ năng/chỉ số, hiệu ứng chưa có nguồn kiểm chứng **để trống**; không tự bịa build hoặc thông số. Ảnh mẫu của sáu nhân vật đầu tiên tham chiếu URL từ site gốc, không được tải/đóng gói tại đây. Nếu máy chủ gốc chặn liên kết ảnh, giao diện có hình chữ thay thế; quản trị có thể nhập URL ảnh mới.

## 2. Triển khai đúng trên Netlify — nên dùng Git

**Không kéo riêng thư mục `public` lên Netlify Drop.** Drop tĩnh chỉ đưa HTML/CSS/JS lên mạng mà không dựng API, lịch đồng bộ và kết nối Netlify Blobs. Khi đó các chức năng quản trị/dữ liệu động sẽ không hoạt động.

1. Giải nén file ZIP thành thư mục `mongil-atlas-netlify`.
2. Đưa **toàn bộ thư mục** lên một repository GitHub (bao gồm `package.json`, `netlify.toml`, `lib`, `netlify/functions`, `public`).
3. Đăng nhập https://app.netlify.com/ → **Add new project** → **Import an existing project** → GitHub → chọn repository.
4. Netlify tự nhận `netlify.toml`. Nếu cần nhập tay: **Build command:** `npm run build`; **Publish directory:** `public`; **Functions directory:** `netlify/functions`. Netlify tự chạy `npm install` trước build.
5. Trong **Project configuration → Environment variables**, thiết lập:
   - `SESSION_SECRET`: chuỗi ngẫu nhiên **ít nhất 32 ký tự** (bắt buộc khuyến nghị).
   - `ADMIN_USERNAME`: `admin` (nếu bỏ trống vẫn mặc định admin).
   - `ADMIN_PASSWORD`: `admin` (nếu bỏ trống vẫn mặc định admin). Đây chỉ là mật khẩu khởi tạo trước khi đổi trên giao diện.
6. Deploy site, kiểm tra `https://TEN-SITE.netlify.app/api/health` phải trả JSON `"online":true`.
7. Truy cập site → **Đăng nhập** → `admin / admin` → **Quản trị → Sao lưu & bảo mật** → **đổi mật khẩu ngay**. Mật khẩu mới được băm bằng scrypt lưu phía server; không lưu plaintext vào frontend.
8. Trong quản trị, thử thêm/sửa/xóa một tin nháp, xuất bản, mở bằng cửa sổ ẩn danh và tải lại để xác nhận dữ liệu đã được chia sẻ thực sự.

### Triển khai bằng Netlify CLI (nếu không dùng GitHub)

Trên Windows với Node.js 20/22+, giải nén, mở PowerShell tại thư mục project:

```powershell
npm install
npm run check
npm test
npx netlify-cli login
npx netlify-cli sites:create
npx netlify-cli link
npx netlify-cli env:set SESSION_SECRET "HAY_THAY_CHUOI_BI_MAT_NGAU_NHIEN_TOI_THIEU_32_KY_TU"
npx netlify-cli deploy --build --prod
```

Netlify CLI có thể hỏi chọn site/project; liên kết với site vừa tạo. Sau khi đặt biến môi trường, thực hiện lại `deploy --build --prod`. Nếu đã có site Netlify thì không cần `sites:create`, chỉ cần `link` tới site đó. Không nhập secret vào nơi công khai hoặc commit `.env` thật lên Git. Lưu ý Netlify CLI và giao diện quản lý có thể thay đổi theo phiên bản.

## 3. Khai báo đồng bộ từ website khác

1. Đăng nhập → **Quản trị → Nguồn cập nhật → Thêm mới**.
2. Nhập **Tên nguồn**, URL **HTTPS**, loại `RSS` / `Atom` / `JSON` / `HTML`, chọn **Danh mục đích** như Tin chính thức, Leak, Nhân vật, Trang bị, Monsterling...
3. Với `HTML`, khai báo **CSS Selector** của các liên kết bài viết, ví dụ `a[href*="/view/"]`. Công cụ lấy văn bản liên kết làm tên mục; HTML không tự suy diễn nội dung trong trang chi tiết. Muốn đồng bộ cấu trúc thông tin chuẩn xác, ưu tiên feed RSS/Atom hoặc API JSON.
4. Bấm **Thử** để xem các mục có thể đọc mà chưa ghi dữ liệu.
5. Bấm **Đồng bộ** để nhập mục mới. Mặc định mục mới là **bản nháp**, quản trị kiểm tra rồi mới công bố.
6. Bật **Tự đồng bộ hằng ngày** để lịch chạy **03:00 UTC = 10:00 giờ Việt Nam**, chỉ ở published deploy Netlify.
7. Chỉ bật **Cho phép nguồn ghi đè bản ghi đã có** khi nguồn đáng tin cậy; chế độ mặc định bảo vệ phần dữ liệu biên tập thủ công.

**Định dạng JSON nguồn tham khảo** (mảng trực tiếp, hoặc `{"items":[...]}`, hoặc `{"data":[...]}`):

```json
[
  {
    "name": "Tên nhân vật mẫu",
    "element": "Hỏa",
    "role": "Fighter",
    "skills": "Kỹ năng 1 ...",
    "image": "https://example.org/images/character.webp",
    "url": "https://example.org/source"
  }
]
```

Chọn `target=characters`. Với nguồn trang bị, thuộc tính tương ứng gồm `name`, `set2`, `set4`, `image`; Monsterling gồm `name`, `linkEffect`, `rankEffect`, `image`; tin tức gồm `title`, `description`/`summary`, `link`/`url`, `date`. Không có nguồn API công khai chuẩn chung cho mọi fanpage/forum; nguồn ngoài có thể chặn robot, không cho lấy dữ liệu hoặc đổi cấu trúc bất kỳ lúc nào. Tôn trọng điều khoản và chính sách sử dụng của nguồn.

Trong bản khởi tạo có cấu hình ví dụ **Netmarble Forum** nhưng **đang tắt**, vì chưa thể xác minh việc HTML selector của forum vận hành ổn định trong môi trường Netlify.

## 4. Đảm bảo hoạt động và giới hạn

- `admin/admin` **cực kỳ dễ bị đoán**. Chỉ để bootstrap; đổi ngay, đặc biệt trước khi gửi liên kết cho hội nhóm. API dùng cookie `HttpOnly`, `Secure`, `SameSite=Strict` trên Netlify; kiểm tra origin, hạn chế số lượt đăng nhập sai và mật khẩu mới scrypt.
- Không dùng Netlify Blobs như cơ sở dữ liệu giao dịch quy mô lớn. Mô hình này phù hợp cộng đồng nhỏ, số lần quản trị ghi tương đối ít. Khi có nhiều quản trị viên cập nhật đồng thời, cần chuyển sang PostgreSQL/Netlify DB vì mỗi collection là một blob theo cơ chế last-write-wins.
- Trang đang phục dựng không kèm file gốc của ChatGPT Sites, ảnh game hoặc bộ dữ liệu đầy đủ từ quản trị gốc. Mục "giống 100%" chỉ có thể xác nhận sau khi nhận mã nguồn gốc và kiểm thử so sánh.
- Đồng bộ tự động chỉ nhập những gì nguồn ngoài thực sự cung cấp; không tự tạo kỹ năng, thống kê, trang bị, build hoặc tin leak thiếu nguồn.
- Netlify Functions/Blobs/Scheduled Functions phải được chạy trên Netlify; `npm run check` và `npm test` chỉ kiểm tra cú pháp, logic với kho dữ liệu giả lập, **không thay thế kiểm thử deploy thực tế**.
- Bản sao lưu JSON không bao gồm mật khẩu và phiên đăng nhập. Hãy tạo sao lưu trước mỗi đợt cập nhật lớn.

## 5. Các bước kiểm tra chấp nhận sau khi deploy

- [ ] `/api/health` trả `online: true`; trang chủ có 29 nhân vật.
- [ ] Chưa đăng nhập không thấy menu/quyền quản trị; không gọi API ghi được.
- [ ] Login `admin/admin` lần đầu, rồi đổi mật khẩu; mật khẩu cũ không còn đăng nhập được.
- [ ] Tạo/sửa/xóa nhân vật; trạng thái nháp chỉ xuất hiện trong quản trị.
- [ ] Tạo build, chọn nhân vật + tối đa 4 bộ trang bị + 3 Monsterling + 1 Legend; chi tiết hiển thị đúng các lựa chọn.
- [ ] Tạo đội hình đúng 3 nhân vật; sửa và xóa đội hình.
- [ ] Thêm tin, leak, trang bị; kiểm tra có thể tải nội dung trên thiết bị/trình duyệt khác.
- [ ] Thử đồng bộ nguồn thực tế, xem bản nháp, chỉnh sửa, xuất bản và kiểm tra URL nguồn.
- [ ] Export JSON, chỉnh một mục, import JSON và xem dữ liệu phục hồi.
- [ ] Deploy lại bản code, kiểm tra dữ liệu lưu trong Blobs không mất.

## 6. Cấu trúc dự án

```text
mongil-atlas-netlify/
├── public/
│   ├── index.html        # giao diện
│   ├── style.css         # giao diện responsive
│   └── app.js            # chức năng người dùng & quản trị
├── lib/
│   ├── seed.mjs          # dữ liệu tham chiếu ban đầu
│   ├── data.mjs          # các bộ sưu tập Netlify Blobs
│   └── feed.mjs          # đồng bộ RSS/Atom/JSON/HTML
├── netlify/functions/
│   ├── api.mjs           # GET/POST API, xác thực và CRUD
│   └── sync-daily.mjs    # đồng bộ theo lịch
├── tests/
│   ├── api.test.mjs      # unit test backend với Blobs giả lập
│   ├── loader.mjs        # mock loader dùng trong npm test
│   └── browser_smoke.py  # test trình duyệt (cần Playwright + Chromium)
├── netlify.toml
├── .env.example
└── package.json
```

**Nguồn tham khảo kỹ thuật:** https://docs.netlify.com/build/data-and-storage/netlify-blobs/ và https://docs.netlify.com/build/functions/scheduled-functions/.

**Nguồn đối chiếu nội dung game:** https://www.kaiden.gg/mongil/characters/ · https://www.kaiden.gg/mongil/monsterlings/ · https://www.kaiden.gg/mongil/equipment/ · https://m.netmarble.com/en/news.
