const validator = require('validator')

class RuleResult {
  constructor(pass, msg = '') {
    Object.assign(this, {
      pass,
      msg
    })
  }
}

class RuleFieldResult extends RuleResult {
  constructor(pass, msg = '', legalValue = null) {
    super(pass, msg)
    this.legalValue = legalValue
  }
}

class Rule {
  constructor(name, msg, ...params) {
    Object.assign(this, {
      name,
      msg,
      params
    })
  }

  validate(field) {
    if (this.name === 'isOptional')
      return new RuleResult(true)
    if (!validator[this.name](field + '', ...this.params)) {
      return new RuleResult(false, this.msg || this.message || '参数错误')
    }
    return new RuleResult(true, '')
  }
}

class RuleField {
  constructor(rules) {
    this.rules = rules
  }

  validate(field) {
    if (field == null) {
      // 如果字段为空
      const allowEmpty = this._allowEmpty()
      const defaultValue = this._hasDefault()
      if (allowEmpty) {
        return new RuleFieldResult(true, '', defaultValue)
      } else {
        return new RuleFieldResult(false, '字段是必填参数')
      }
    }

    const filedResult = new RuleFieldResult(false)
    for (let rule of this.rules) {
      let result = rule.validate(field)
      if (!result.pass) {
        filedResult.msg = result.msg
        filedResult.legalValue = null
        // 一旦一条校验规则不通过，则立即终止这个字段的验证
        return filedResult
      }
    }
    return new RuleFieldResult(true, '', this._convert(field))
  }

  _convert(value) {
    for (let rule of this.rules) {
      if (rule.name === 'isInt') {
        return parseInt(value)
      }
      if (rule.name === 'isFloat') {
        return parseFloat(value)
      }
      if (rule.name === 'isBoolean') {
        return !!value
      }
    }
    return value
  }

  _allowEmpty() {
    for (let rule of this.rules) {
      if (rule.name === 'isOptional') {
        return true
      }
    }
    return false
  }

  _hasDefault() {
    for (let rule of this.rules) {
      const defaultValue = rule.params[0]
      if (rule.name === 'isOptional') {
        return defaultValue
      }
    }
  }
}

module.exports = {
  Rule,
  RuleField,
  RuleFieldResult,
  RuleResult
}
