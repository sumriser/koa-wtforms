const { get, last, set, cloneDeep } = require('lodash')
const { Rule } = require('./rule')
const { findMembers } = require('./util')

class Validator {
  constructor() {
    this.data = {}
    this.parsed = {}
  }

  _assembleAllParams(ctx) {
    return {
      body: ctx.request.body,
      query: ctx.request.query,
      path: ctx.params,
      header: ctx.request.header
    }
  }

  get(path, parsed = true) {
    if (parsed) {
      const value = get(this.parsed, path, null)
      if (value == null) {
        const keys = path.split('.')
        const key = last(keys)
        return get(this.parsed.default, key)
      }
      return value
    } else {
      return get(this.data, path)
    }
  }

  _findMembersFilter(key) {
    if (/validate([A-Z])\w+/g.test(key)) {
      return true
    }
    if (this[key] instanceof Array) {
      this[key].forEach(value => {
        if (!value instanceof Rule) throw new ParameterError(`parameter "${ key }" isn't instanceof Rule.`)
      })
      return true
    }
    return this[key] instanceof Rule;
  }

  async validate(ctx, alias = {}) {
    this.alias = alias
    let params = this._assembleAllParams(ctx)
    this.data = cloneDeep(params)
    this.parsed = cloneDeep(params)

    const memberKeys = findMembers(this, {
      filter: this._findMembersFilter.bind(this)
    })

    for (let key of memberKeys) {
      const result = await this._check(key, alias)
      if (!result.success) throw new ParameterError(result.msg)
    }

    ctx.v = this
    return this
  }

  async _check(key, alias = {}) {
    const isCustomFunc = typeof (this[key]) == 'function'
    let result;
    if (isCustomFunc) {
      // validate functions
      try {
        await this[key](this.data)
        result = new RuleResult(true)
      } catch (error) {
        result = new RuleResult(false, error.msg || error.message || '参数错误')
      }
    } else {
      // validate props, Rule or [Rule]
      const rules = this[key] instanceof Rule ? [this[key]] : this[key]
      const ruleField = new RuleField(rules)
      // 别名替换
      key = alias[key] ? alias[key] : key
      const param = this._findParam(key)

      result = ruleField.validate(param.value)

      if (result.pass) {
        // 如果参数路径不存在，往往是因为用户传了空值，而又设置了默认值
        if (param.path.length === 0) {
          set(this.parsed, ['default', key], result.legalValue)
        } else {
          set(this.parsed, param.path, result.legalValue)
        }
      }
    }
    if (!result.pass) {
      const msg = `${ isCustomFunc ? '' : key }${ result.msg }`
      return {
        msg: msg,
        success: false
      }
    }
    return {
      msg: 'ok',
      success: true
    }
  }

  _findParam(key) {
    let value
    value = get(this.data, ['query', key])
    if (value) {
      return {
        value,
        path: ['query', key]
      }
    }
    value = get(this.data, ['body', key])
    if (value) {
      return {
        value,
        path: ['body', key]
      }
    }
    value = get(this.data, ['path', key])
    if (value) {
      return {
        value,
        path: ['path', key]
      }
    }
    value = get(this.data, ['header', key])
    if (value) {
      return {
        value,
        path: ['header', key]
      }
    }
    return {
      value: null,
      path: []
    }
  }
}

class ParameterError extends Error {
  constructor(msg) {
    super()
    this.msg = msg || ''
  }
}

module.exports = {
  Rule,
  Validator,
  ParameterError,
}
