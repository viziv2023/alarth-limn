class FlagEditor {
  constructor(gridElementId) {
    this.containerId = gridElementId;
    this.container = typeof gridElementId === "string" ? document.getElementById(gridElementId) : gridElementId;
    this.rows = 3;
    this.cols = 4;
    this.selectedColor = "#c0392b";
    this.resetData();
    this.init();
  }

  resetData() {
    this.gridData = [
      ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
      ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
      ["#ffffff", "#ffffff", "#ffffff", "#ffffff"]
    ];
  }

  init() {
    if (!this.container && this.containerId) {
      this.container = document.getElementById(this.containerId);
    }
    if (!this.container) return;

    this.container.innerHTML = "";

    // تثبيت أبعاد ونمط شبكة العلم برمجياً لضمان الظهور الفوري في النافذة
    this.container.style.display = "grid";
    this.container.style.gridTemplateColumns = "repeat(4, 1fr)";
    this.container.style.gridTemplateRows = "repeat(3, 44px)";
    this.container.style.gap = "4px";
    this.container.style.width = "100%";
    this.container.style.maxWidth = "280px";
    this.container.style.margin = "8px auto 14px auto";
    this.container.style.padding = "6px";
    this.container.style.background = "#0b1220";
    this.container.style.border = "2px solid #334155";
    this.container.style.borderRadius = "8px";
    this.container.style.boxSizing = "border-box";

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const pixel = document.createElement("div");
        pixel.classList.add("flag-pixel");
        pixel.style.backgroundColor = this.gridData[r][c];
        pixel.style.width = "100%";
        pixel.style.height = "100%";
        pixel.style.minHeight = "44px";
        pixel.style.borderRadius = "4px";
        pixel.style.cursor = "pointer";
        pixel.style.border = "1px solid rgba(0, 0, 0, 0.25)";
        pixel.style.boxSizing = "border-box";
        pixel.style.transition = "transform 0.1s ease, border-color 0.1s ease";

        pixel.addEventListener("mouseenter", () => {
          pixel.style.borderColor = "#fbbf24";
          pixel.style.transform = "scale(0.96)";
        });

        pixel.addEventListener("mouseleave", () => {
          pixel.style.borderColor = "rgba(0, 0, 0, 0.25)";
          pixel.style.transform = "scale(1)";
        });

        pixel.addEventListener("click", () => {
          this.gridData[r][c] = this.selectedColor;
          pixel.style.backgroundColor = this.selectedColor;
        });

        this.container.appendChild(pixel);
      }
    }
  }

  // تصفير المحرر لبناء علم جديد نظيف
  clearGrid() {
    this.resetData();
    this.init();
  }

  setColor(color) {
    this.selectedColor = color;
  }

  // عمل Deep Clone حتى لا تشترك الدول في نفس الذاكرة
  getFlagData() {
    return this.gridData.map(row => [...row]);
  }

  // دالة عامة لرسم العلم بأي حجم (سواء في الجدول أو في صفحة الدولة)
  static renderFlag(container, flagMatrix, pixelWidth = 10, pixelHeight = 8) {
    if (!container) return;
    container.innerHTML = "";
    if (!flagMatrix) return;

    container.style.display = "grid";
    const colRule = typeof pixelWidth === "number" ? `repeat(4, ${pixelWidth}px)` : `repeat(4, ${pixelWidth})`;
    const rowRule = typeof pixelHeight === "number" ? `repeat(3, ${pixelHeight}px)` : `repeat(3, ${pixelHeight})`;
    container.style.gridTemplateColumns = colRule;
    container.style.gridTemplateRows = rowRule;

    if (Array.isArray(flagMatrix) && flagMatrix.length === 3 && Array.isArray(flagMatrix[0])) {
      for (let r = 0; r < flagMatrix.length; r++) {
        for (let c = 0; c < flagMatrix[r].length; c++) {
          const dot = document.createElement("div");
          dot.style.backgroundColor = flagMatrix[r][c] || "#ffffff";
          container.appendChild(dot);
        }
      }
    } else if (Array.isArray(flagMatrix)) {
      flagMatrix.forEach(col => {
        const dot = document.createElement("div");
        dot.style.backgroundColor = col || "#ffffff";
        container.appendChild(dot);
      });
    }
  }

  static renderFlagToElement(flagMatrix, container) {
    FlagEditor.renderFlag(container, flagMatrix, "1fr", "1fr");
  }
}

window.FlagEditor = FlagEditor;