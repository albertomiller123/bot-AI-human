# 💡 BRIEF: Antigravity "Stealth Project" Agent

**Ngày tạo:** 30/01/2026
**Brainstorm cùng:** User (Vibe Coder) & Antigravity

---

## 1. VẤN ĐỀ CẦN GIẢI QUYẾT
Các bot Minecraft hiện tại quá hoàn hảo và máy móc, dễ bị phát hiện trong môi trường SMP. Chúng thiếu khả năng xã hội tinh tế để phân biệt "bạn bè" và "người lạ", cũng như không biết cách từ chối khéo léo.

## 2. GIẢI PHÁP ĐỀ XUẤT
Xây dựng một **"Deep Cover Agent"** tập trung vào khả năng **ngụy trang xã hội** (Social Stealth). Bot sẽ hoạt động như một người chơi bình thường, biết chọn lọc người để giao tiếp và biết bịa chuyện để che giấu danh tính AI.

## 3. MỤC TIÊU (THE CHALLENGE)
- **Survival:** Sinh tồn tự động (Ăn, Mặc, Ở).
- **Social Camouflage:** Trà trộn vào nhóm bạn của User mà không bị phát hiện.
- **Duration:** **Endless Mode** (Chạy vô tận cho đến khi bị phát hiện hoặc chán). Không giới hạn số ngày trong config.

## 4. QUY TẮC XÃ HỘI (SOCIAL PROTOCOL - CRITICAL)

### 🛡️ Trusted Network (Mạng lưới tin cậy)
- **Config:** Danh sách cố định `trusted_players` (Đồng đội/Owner) trong config.
- **Consistency:** Luôn nhận diện và nhất quán với nhóm này. Nếu bị hỏi "mày team ai?", trả lời theo kịch bản định sẵn.

### 👂 Selective Hearing (Nghe chọn lọc)
- Bot **KHÔNG** trả lời tất cả mọi người.
- **Chỉ phản hồi khi:**
    1. Bị gọi đích danh (Username hoặc Biệt danh cài sẵn).
    2. Nhận tin nhắn riêng (Whisper).
    3. Người nói là **Owner** (Quyền lực tối cao).

### 🛡️ Authority & Deflection (Quyền hạn & Từ chối)
- **Obedience:** Chỉ thực hiện lệnh (ví dụ: "vứt gỗ đây", "đi mine đi") từ **Owner**.
- **Deflection (Với người lạ/Bạn thường):** Nếu người khác ra lệnh, bot sẽ **từ chối khéo** dựa trên ngữ cảnh:
    - *"Đang dở tay tí"* (Nếu đang xây).
    - *"Full rương rồi, đợi tí"* (Nếu đang đi mine).
    - *"Lag quá không nghe rõ"* (Lý do kinh điển).
    - Tuyệt đối không nói "Tôi không nghe lệnh bạn" -> Lộ là bot.

## 5. TÍNH NĂNG CỐT LÕI (CORE FEATURES)

### 🚀 MVP (Foundation)
- [ ] **Social Brain v2:**
    - `Lie Ledger`: Sổ tay nói dối.
    - `Relationship Manager`: Phân biệt Owner vs Stranger.
- [ ] **Humanized Movement:** `GCD Rotation`, di chuyển không hoàn hảo.
- [ ] **Chat Filter:** Logic lọc tin nhắn để quyết định: Trả lời / Lờ đi / Từ chối khéo.
- [ ] **Mission Control:** Kế hoạch dài hạn tự động (Xây nhà -> Farm -> Đi Nether).

### 🎁 Phase 2 (Advanced)
- [ ] **Improvisation:** Xử lý tình huống bị troll/nhốt.
- [ ] **Context Awareness:** Nhớ vị trí địa lý sự kiện ("Chỗ này hôm qua PK dính chưởng").

### ❌ Removed Features
- [Release] Voice Chat (User xác nhận không cần).
- [Config] Hard limit 100 days (Chuyển sang chạy vô tận).

## 6. BƯỚC TIẾP THEO
→ Chạy `/plan` để lên thiết kế module `Social Brain v2` và `Chat Filter` chi tiết.
