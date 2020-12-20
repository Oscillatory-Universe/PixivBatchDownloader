// 初始化用户页面
import { InitPageBase } from './InitPageBase'
import { Colors } from './Colors'
import { lang } from './Lang'
import { options } from './setting/Options'
import { API } from './API'
import { store } from './Store'
import { EVT } from './EVT'
import { log } from './Log'
import { DOM } from './DOM'
import { userWorksType, tagPageFlag } from './CrawlArgument.d'
import { UserImageWorksWithTag, UserNovelsWithTag } from './CrawlResult'
import { IDListType } from './Store.d'
import { states } from './States'
import './SaveAvatarIcon'
import { BookmarkAllWorks, IDList } from './BookmarkAllWorks'
import { SelectWork } from './SelectWork'

class InitUserPage extends InitPageBase {
  constructor() {
    super()
    this.init()
  }

  private listType = 0 // 细分的列表类型

  private onceNumber = 48 // 每页作品个数，插画是 48 个，小说是 24 个

  private bookmarkAll = new BookmarkAllWorks()

  // 添加中间按钮
  protected addCrawlBtns() {
    DOM.addBtn('crawlBtns', Colors.blue, lang.transl('_开始抓取'), [
      ['title', lang.transl('_开始抓取') + lang.transl('_默认下载多页')],
    ]).addEventListener('click', () => {
      this.readyCrawl()
    })
  }

  protected addAnyElement() {
    DOM.addBtn('otherBtns', Colors.green, lang.transl('_保存用户头像为图标'), [
      ['title', lang.transl('_保存用户头像为图标说明')],
    ]).addEventListener('click', () => {
      EVT.fire(EVT.list.saveAvatarIcon)
    })

    // 添加收藏本页所有作品的功能
    const bookmarkAllBtn = DOM.addBtn(
      'otherBtns',
      Colors.green,
      lang.transl('_收藏本页面的所有作品'),
    )
    this.bookmarkAll = new BookmarkAllWorks(bookmarkAllBtn)

    bookmarkAllBtn.addEventListener('click', async () => {
      // 获取该用户的所有作品的 id 列表
      // 模拟了抓取流程，以获取相同的 id 列表
      EVT.fire(EVT.list.bookmarkModeStart)
      store.tag = API.getTagFromURL()
      this.crawlNumber = 1 // 设置为只抓取 1 页
      this.readyGetIdList()
    })

    window.addEventListener(EVT.list.getIdListFinished, this.sendBookmarkIdList)
  }

  protected initAny(){
    new SelectWork()
  }

  private sendBookmarkIdList = () => {
    if (states.bookmarkMode) {
      // 将 id 的 type 设置为 illusts 或 novels
      const list: IDList[] = []
      for (const data of store.idList) {
        if (data.type === 'novels') {
          list.push(data as IDList)
        } else {
          list.push({
            type: 'illusts',
            id: data.id,
          })
        }
      }

      store.idList = [] // 清空这次抓取到的 id 列表
      this.bookmarkAll.sendIdList(list)
    }
  }

  protected setFormOption() {
    // 个数/页数选项的提示
    options.setWantPageTip({
      text: lang.transl('_页数'),
      tip: lang.transl('_从本页开始下载提示'),
      rangTip: lang.transl('_数字提示1'),
    })
  }

  protected getWantPage() {
    this.crawlNumber = this.checkWantPageInput(
      lang.transl('_从本页开始下载x页'),
      lang.transl('_下载所有页面'),
    )
  }

  protected nextStep() {
    this.readyGetIdList()

    log.log(lang.transl('_正在抓取'))
  }

  protected readyGetIdList() {
    // 判断页面类型
    // 匹配 pathname 里用户 id 之后的字符
    const test = location.pathname.match(/\/users\/\d+(\/.+)/)
    if (test === null) {
      // 用户主页
      this.listType = 0
    } else if (test.length === 2) {
      const str = test[1] //取出用户 id 之后的字符
      if (str.includes('/artworks')) {
        // 插画和漫画列表
        this.listType = 1
      } else if (str.includes('/illustrations')) {
        // 插画列表
        this.listType = 2
      } else if (str.includes('/manga')) {
        // 漫画列表
        this.listType = 3
      } else if (str.includes('/novels')) {
        // 小说列表
        this.listType = 4
        this.onceNumber = 24 // 如果是在小说列表页，一页只有 24 个作品
      }
    }

    store.tag ? this.getIdListByTag() : this.getIdList()
  }

  private getOffset() {
    const nowPage = API.getURLSearchField(location.href, 'p') // 判断当前处于第几页，页码从 1 开始。也可能没有页码
    let offset: number = 0
    if (nowPage) {
      offset = (parseInt(nowPage) - 1) * this.onceNumber
    }
    if (offset < 0) {
      offset = 0
    }

    return offset
  }

  // 根据页数设置，计算要下载的个数
  private getRequsetNumber() {
    let requsetNumber = 9999999
    if (this.crawlNumber !== -1) {
      requsetNumber = this.onceNumber * this.crawlNumber
    }
    return requsetNumber
  }

  // 获取用户某些类型的作品的 id 列表
  protected async getIdList() {
    let type: userWorksType[] = []

    switch (this.listType) {
      case 0:
        type = ['illusts', 'manga', 'novels']
        break
      case 1:
        type = ['illusts', 'manga']
        break
      case 2:
        type = ['illusts']
        break
      case 3:
        type = ['manga']
        break
      case 4:
        type = ['novels']
        break
    }

    let idList = await API.getUserWorksByType(DOM.getUserId(), type)

    // 判断是否全都是小说，如果是，把每页的作品个数设置为 24 个
    const allWorkIsNovels = idList.every((data) => {
      return data.type === 'novels'
    })
    allWorkIsNovels && (this.onceNumber = 24)

    // 计算偏移量和需要保留的作品个数
    const offset = this.getOffset()
    const requsetNumber = this.getRequsetNumber()

    // 按照 id 升序排列，之后会删除不需要的部分
    idList.sort(API.sortByProperty('id')).reverse()

    // 不带 tag 获取作品时，由于 API 是一次性返回用户的所有作品，可能大于要求的数量，所以需要去掉多余的作品。
    // 删除 offset 需要去掉的部分。删除后面的 id，也就是近期作品
    idList.splice(idList.length - offset, idList.length)

    // 删除超过 requsetNumber 的作品。删除前面的 id，也就是早期作品
    if (idList.length > requsetNumber) {
      idList.splice(0, idList.length - requsetNumber)
    }

    // 储存
    store.idList = store.idList.concat(idList)

    this.getIdListFinished()
  }

  // 获取用户某些类型的作品的 id 列表（附带 tag）
  private async getIdListByTag() {
    // 这里不用判断 0 也就是用户主页的情况，因为用户主页不会带 tag
    let flag: tagPageFlag = 'illustmanga'
    switch (this.listType) {
      case 1:
        flag = 'illustmanga'
        break
      case 2:
        flag = 'illusts'
        break
      case 3:
        flag = 'manga'
        break
      case 4:
        flag = 'novels'
        break
    }

    // 计算偏移量和需要保留的作品个数
    const offset = this.getOffset()
    const requsetNumber = this.getRequsetNumber()

    let data = await API.getUserWorksByTypeWithTag(
      DOM.getUserId(),
      flag,
      store.tag,
      offset,
      requsetNumber,
    )

    // 图片和小说返回的数据是不同的，小说并没有 illustType 标记
    if (this.listType === 4) {
      const d = data as UserNovelsWithTag
      d.body.works.forEach((data) =>
        store.idList.push({
          type: 'novels',
          id: data.id,
        }),
      )
    } else {
      const d = data as UserImageWorksWithTag
      d.body.works.forEach((data) => {
        let type: IDListType = 'illusts'
        switch (data.illustType) {
          case 0:
            type = 'illusts'
            break
          case 1:
            type = 'manga'
            break
          case 2:
            type = 'ugoira'
            break
        }
        store.idList.push({
          type,
          id: data.id,
        })
      })
    }

    this.getIdListFinished()
  }

  protected resetGetIdListStatus() {
    this.listType = 0
  }

  protected sortResult() {
    // 把作品数据按 id 倒序排列，id 大的在前面，这样可以先下载最新作品，后下载早期作品
    store.result.sort(API.sortByProperty('id'))
  }

  protected destroy() {
    DOM.clearSlot('crawlBtns')
    DOM.clearSlot('otherBtns')

    window.removeEventListener(
      EVT.list.getIdListFinished,
      this.sendBookmarkIdList,
    )
  }
}
export { InitUserPage }
