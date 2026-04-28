import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static targets = ["popup"];

  connect() {
    this._boundClose = this._closeOnOutsideClick.bind(this);
    document.addEventListener("mousedown", this._boundClose);
  }

  disconnect() {
    document.removeEventListener("mousedown", this._boundClose);
  }

  toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    this.popupTarget.hidden = !this.popupTarget.hidden;
  }

  close() {
    this.popupTarget.hidden = true;
  }

  _closeOnOutsideClick(e) {
    if (!this.element.contains(e.target)) this.close();
  }
}
