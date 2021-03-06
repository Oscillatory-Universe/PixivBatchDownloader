import { EVT } from './EVT'
import { DOM } from './DOM'
import { store } from './Store'
import { lang } from './Lang'
import { Tools } from './Tools'
import { toast } from './Toast'

class ExportResult {
  constructor() {
    this.bindEvents()
  }

  private bindEvents() {
    window.addEventListener(EVT.list.exportResult, () => {
      this.output()
    })
  }

  private output() {
    // 如果没有数据则不执行
    if (store.result.length === 0) {
      toast.error(lang.transl('_没有数据可供使用'))
      return
    }

    const str = JSON.stringify(store.result, null, 2)
    const blob = new Blob([str], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    Tools.downloadFile(
      url,
      `result-${Tools.replaceUnsafeStr(
        DOM.getTitle()
      )}-${store.crawlCompleteTime.getTime()}.json`
    )

    toast.success(lang.transl('_导出成功'))
  }
}

new ExportResult()
