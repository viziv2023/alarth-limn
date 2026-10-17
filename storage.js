class StorageManager {
  static STORAGE_KEY = "age_of_hegemony_autosave";

  // 1. الحفظ التلقائي الفوري في ذاكرة المتصفح المحلية
  static autoSave(world) {
    try {
      if (!world) return;
      const dataStr = JSON.stringify(world.toJSON());
      localStorage.setItem(this.STORAGE_KEY, dataStr);
    } catch (err) {
      console.warn("تعذر الحفظ التلقائي في الذاكرة المحلية:", err);
    }
  }

  // 2. استرجاع آخر حفظ تلقائي عند فتح اللعبة
  static loadAutoSave() {
    try {
      const dataStr = localStorage.getItem(this.STORAGE_KEY);
      if (!dataStr) return null;
      const parsed = JSON.parse(dataStr);
      return window.World ? window.World.fromJSON(parsed) : null;
    } catch (err) {
      console.error("فشل استرجاع الحفظ التلقائي:", err);
      return null;
    }
  }

  // 3. تصدير وتحميل ملف JSON خارجي وحفظه على جهاز اللاعب مباشرة (حماية قصوى)
  static exportToFile(world) {
    try {
      const dataStr = JSON.stringify(world.toJSON(), null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `hegemony_save_year_${world.year}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // حفظ نسخة تلقائية إضافية
      this.autoSave(world);
    } catch (err) {
      alert("حدث خطأ أثناء تصدير الملف!");
    }
  }

  // 4. قراءة ملف JSON يدوي من جهاز اللاعب
  static importFromFile(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const world = window.World.fromJSON(parsed);
        // حفظه كتلقائي فور استيراده
        this.autoSave(world);
        callback(null, world);
      } catch (err) {
        callback("الملف غير صالح أو تالف!", null);
      }
    };
    reader.onerror = () => callback("فشلت قراءة الملف!", null);
    reader.readAsText(file);
  }
}

window.StorageManager = StorageManager;