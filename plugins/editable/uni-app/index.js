/**
 * @fileoverview editable 插件
 */
const config = require('./config')

function editable(vm) {
  this.vm = vm
  this.editHistory = []      // 历史记录
  this.editI = -1            // 历史记录指针
  vm._mask = []              // 蒙版被点击时进行的操作

  vm._set = function (path, val) {
    var paths = path.split('.'),
      target = vm
    for (var i = 0; i < paths.length - 1; i++)
      target = target[paths[i]]
    vm.$set(target, paths.pop(), val)
  }

  /**
   * @description 移动历史记录指针
   * @param {Number} num 移动距离
   */
  var move = num => {
    setTimeout(() => {
      var item = this.editHistory[this.editI + num]
      if (item) {
        this.editI += num
        vm._set(item.key, item.value)
      }
    }, 200)
  }
  vm.undo = () => move(-1) // 撤销
  vm.redo = () => move(1)  // 重做

  /**
   * @description 更新记录
   * @param {String} path 更新内容路径
   * @param {*} oldVal 旧值
   * @param {*} newVal 新值
   * @param {Boolean} set 是否更新到视图
   * @private
   */
  vm._editVal = (path, oldVal, newVal, set) => {
    // 当前指针后的内容去除
    while (this.editI < this.editHistory.length - 1)
      this.editHistory.pop()

    // 最多存储 30 条操作记录
    while (this.editHistory.length > 30) {
      this.editHistory.pop()
      this.editI--
    }

    var last = this.editHistory[this.editHistory.length - 1]
    if (!last || last.key != path) {
      if (last) {
        // 去掉上一次的新值
        this.editHistory.pop()
        this.editI--
      }
      // 存入这一次的旧值
      this.editHistory.push({
        key: path,
        value: oldVal
      })
      this.editI++
    }

    // 存入本次的新值
    this.editHistory.push({
      key: path,
      value: newVal
    })
    this.editI++

    // 更新到视图
    if (set)
      vm._set(path, newVal)
  }

  /**
   * @description 获取菜单项
   * @private
   */
  vm._getItem = function (node) {
    var items
    if (node.name == 'img') {
      items = config.img.slice(0)
      if (!vm.getSrc) {
        let i = items.indexOf('换图')
        if (i != -1)
          items.splice(i, 1)
        i = items.indexOf('设置预览图')
        if (i != -1)
          items.splice(i, 1)
      }
      let i = items.indexOf('禁用预览')
      if (i != -1 && node.attrs.ignore)
        items[i] = '启用预览'
    } else if (node.name == 'a')
      items = config.link.slice(0)
    else if (node.name == 'video' || node.name == 'audio') {
      items = config.media.slice(0)
      let i = items.indexOf('封面')
      if (!vm.getSrc && i != -1)
        items.splice(i, 1)
      i = items.indexOf('循环')
      if (node.attrs.loop && i != -1)
        items[i] = '不循环'
    } else
      items = config.node.slice(0)
    return items
  }

  /**
   * @description 显示 tooltip
   * @param {object} obj
   * @private
   */
  vm._tooltip = function (obj) {
    vm.$set(vm, 'tooltip', {
      top: obj.top,
      items: obj.items
    })
    vm._tooltipcb = obj.success
  }

  /**
   * @description 显示滚动条
   * @param {object} obj
   * @private
   */
  vm._slider = function (obj) {
    vm.$set(vm, 'slider', {
      min: obj.min,
      max: obj.max,
      value: obj.value,
      top: obj.top
    })
    vm._slideringcb = obj.changing
    vm._slidercb = obj.change
  }

  /**
   * @description 点击蒙版
   * @private
   */
  vm._maskTap = function () {
    // 隐藏所有悬浮窗
    while (vm._mask.length)
      (vm._mask.pop())()
    if (vm.tooltip)
      vm.$set(vm, 'tooltip', null)
    if (vm.slider)
      vm.$set(vm, 'slider', null)
  }

  /**
   * @description 插入节点
   * @param {Object} node 
   */
  function insert(node) {
    if (vm._edit)
      vm._edit.insert(node)
    else
      vm.nodes.push(node)
  }

  /**
   * @description 在光标处插入一张图片
   */
  vm.insertImg = function () {
    vm.getSrc && vm.getSrc('img').then(src => {
      insert({
        name: 'img',
        attrs: {
          src
        }
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一个链接
   */
  vm.insertLink = function () {
    vm.getSrc && vm.getSrc('link').then(url => {
      insert({
        name: 'a',
        attrs: {
          href: url
        },
        children: [{
          type: 'text',
          text: url
        }]
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一个视频
   */
  vm.insertVideo = function () {
    vm.getSrc && vm.getSrc('video').then(src => {
      if (typeof src == 'string')
        src = [src]
      insert({
        name: 'div',
        attrs: {
          style: 'text-align:center'
        },
        children: [{
          name: 'video',
          attrs: {},
          children: [],
          src
        }]
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一个音频
   */
  vm.insertAudio = function () {
    vm.getSrc && vm.getSrc('audio').then(src => {
      if (typeof src == 'string')
        src = [src]
      insert({
        name: 'div',
        attrs: {
          style: 'text-align:center'
        },
        children: [{
          name: 'audio',
          attrs: {},
          children: [],
          src
        }]
      })
    }).catch(() => { })
  }

  /**
   * @description 在光标处插入一段文本
   */
  vm.insertText = function () {
    insert({
      name: 'p',
      attrs: {},
      children: [{
        type: 'text',
        text: '新段落'
      }]
    })
  }

  /**
   * @description 清空内容
   */
  vm.clear = function () {
    vm.$set(vm, 'nodes', [{
      name: 'p',
      attrs: {},
      children: [{
        type: 'text',
        text: '开始'
      }]
    }])
  }

  /**
   * @description 获取编辑后的 html
   */
  vm.getContent = function () {
    var html = '';
    // 递归遍历获取
    (function traversal(nodes, table) {
      for (var i = 0; i < nodes.length; i++) {
        var item = nodes[i]
        if (item.type == 'text')
          html += item.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>').replace(/\xa0/g, '&nbsp;') // 编码实体
        else {
          if (item.name == 'img') {
            item.attrs.i = ''
            // 还原被转换的 svg
            if ((item.attrs.src || '').includes('data:image/svg+xml;utf8,')) {
              html += item.attrs.src.substr(24).replace(/%23/g, '#').replace('<svg', '<svg style="' + (item.attrs.style || '') + '"')
              continue
            }
          }
          // 还原 video 和 audio 的 source
          else if (item.name == 'video' || item.name == 'audio') {
            item = JSON.parse(JSON.stringify(item))
            if (item.src.length > 1) {
              item.children = []
              for (let j = 0; j < item.src.length; j++)
                item.children.push({
                  name: 'source',
                  attrs: {
                    src: item.src[j]
                  }
                })
            } else
              item.attrs.src = item.src[0]
          }
          // 还原滚动层
          else if (item.name == 'div' && (item.attrs.style || '').includes('overflow:auto') && (item.children[0] || {}).name == 'table')
            item = item.children[0]
          // 还原 table
          if (item.name == 'table') {
            item = JSON.parse(JSON.stringify(item))
            table = item.attrs
            if ((item.attrs.style || '').includes(';display:grid')) {
              item.attrs.style = item.attrs.style.split(';display:grid')[0]
              var children = [{
                name: 'tr',
                attrs: {},
                children: []
              }]
              for (let j = 0; j < item.children.length; j++) {
                item.children[j].attrs.style = item.children[j].attrs.style.replace(/grid-[^;]+;*/g, '')
                if (item.children[j].r != children.length) {
                  children.push({
                    name: 'tr',
                    attrs: {},
                    children: [item.children[j]]
                  })
                } else
                  children[children.length - 1].children.push(item.children[j])
              }
              item.children = children
            }
          }
          html += '<' + item.name
          for (var attr in item.attrs) {
            var val = item.attrs[attr]
            if (!val)
              continue
            // bool 型省略值
            if (val == 'T' || val === true) {
              html += ' ' + attr
              continue
            }
            // 取消为了显示 table 添加的 style
            else if (item.name[0] == 't' && attr == 'style' && table) {
              val = val.replace(/;*display:table[^;]*/, '')
              if (table.border)
                val = val.replace(/border[^;]+;*/g, $ => $.includes('collapse') ? $ : '')
              if (table.cellpadding)
                val = val.replace(/padding[^;]+;*/g, '')
              if (!val)
                continue
            }
            html += ' ' + attr + '="' + val.replace(/"/g, '&quot;') + '"'
          }
          html += '>'
          if (item.children) {
            traversal(item.children, table)
            html += '</' + item.name + '>'
          }
        }
      }
    })(vm.nodes)

    // 其他插件处理
    for (let i = vm.plugins.length; i--;)
      if (vm.plugins[i].onGetContent)
        html = vm.plugins[i].onGetContent(html) || html

    return html
  }
}

editable.prototype.onUpdate = function (content, config) {
  if (this.vm.editable) {
    this.vm._edit = void 0
    config.entities.amp = '&'
    if (!content)
      return '<p>开始</p>'
  }
}

module.exports = editable