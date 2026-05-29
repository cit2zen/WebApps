// 설정 패널: 배경음/효과음 볼륨 슬라이더.
export class Settings {
  constructor(audio, { onOpen, onClose }) {
    this.audio = audio;
    this.panel = document.getElementById("settings");
    this.btn = document.getElementById("settings-btn");
    this.closeBtn = document.getElementById("settings-close");
    this.bgm = document.getElementById("bgm-vol");
    this.sfx = document.getElementById("sfx-vol");
    this.bgmOut = document.getElementById("bgm-out");
    this.sfxOut = document.getElementById("sfx-out");

    this.bgm.value = audio.bgmVol;
    this.sfx.value = audio.sfxVol;
    this._sync();

    this.btn.addEventListener("click", () => { this.open(); onOpen && onOpen(); });
    this.closeBtn.addEventListener("click", () => { this.close(); onClose && onClose(); });
    this.panel.addEventListener("click", (e) => {
      if (e.target === this.panel) { this.close(); onClose && onClose(); }
    });

    this.bgm.addEventListener("input", () => { audio.setBgmVol(Number(this.bgm.value)); this._sync(); });
    this.sfx.addEventListener("input", () => { audio.setSfxVol(Number(this.sfx.value)); this._sync(); });
  }

  _sync() {
    this.bgmOut.textContent = Math.round(this.audio.bgmVol * 100) + "%";
    this.sfxOut.textContent = Math.round(this.audio.sfxVol * 100) + "%";
  }

  open() { this.audio._ensure(); this.panel.classList.remove("hidden"); }
  close() { this.panel.classList.add("hidden"); }
  get isOpen() { return !this.panel.classList.contains("hidden"); }
}
