# Design Specifications: Minecraft Authentic (Option C)

## 🎨 Color Palette
| Name | Hex | Usage |
|------|-----|-------|
| Background | #1c1c1c | Main app background (Obsidian/Deepslate tone) |
| Panel Bg | rgba(30, 30, 30, 0.9) | Semi-transparent dark panels |
| Border Dark | #111111 | Panel borders (bevel effect) |
| Border Light| #505050 | Panel highlights |
| Text White | #ffffff | Primary text with shadow |
| MC Green | #55ff55 | Success, Reflex Brain, Health |
| MC Red | #ff5555 | Danger, Offline, Error |
| MC Gold | #ffaa00 | Titles, Strategy Brain, Focus |
| MC Aqua | #55ffff | Vision Header, Diamonds |

## 📝 Typography
*   **Font**: `'VT323'`, monospace (Google Fonts)
*   **Size Base**: 20px
*   **Text Shadow**: `2px 2px 0px #000000` (Crucial for MC look)

## 🧱 Components

### 1. Panel (Window)
*   **Border**: 3px solid, specialized coloring for 3D effect.
*   **Structure**: Header + Content.
*   **Header**: Darkened background, centered text.

### 2. Minecraft Button
*   **Normal**: Grey (#757575) with 3D bevels (Top/Left light, Bot/Right dark).
*   **Active**: Darker (#505050) with inverted bevels.
*   **Primary**: Green variation.
*   **Danger**: Red variation.
*   **Font**: 22px, All Caps.

### 3. Logs (Brain Streams)
*   **Reflex Stream**: Green text, fast scrolling.
*   **Strategy Stream**: Gold text, detailed plans.
*   **Chat**: Aqua text.

## 📐 Layout (Grid)
*   **Columns**: 3 (Left Panel 350px | Main Vision Auto | Right Panel 350px)
*   **Responsive**: Flex column on mobile (TODO for future phase).

## 🔮 Vision Integration
*   **Source**: `http://localhost:3008` (Internal Prismarine Viewer).
*   **Fallback**: "VISION OFFLINE" placeholder text.
