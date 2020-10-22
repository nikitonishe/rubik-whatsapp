const { Kubik } = require('rubik-main');
const fetch = require('node-fetch');
const set = require('lodash/set');
const isObject = require('lodash/isObject');
const get = require('lodash/get');
const querystring = require('querystring');

const methods = require('./Pact/methods');

const PactError = require('../errors/PactError');

const DEFAULT_HOST = 'https://api.pact.im';
const DEFAULT_VERSION = 'v8.0';

/**
 * Кубик для запросов к API Pact
 * @class
 * @prop {String} [token] токен для доступа к API
 * @prop {String} [host=DEFAULT_HOST] адрес API Pact
 */
class Pact extends Kubik {
  constructor(token, host, version) {
    super(...arguments);
    this.token = token || null;
    this.host = host || null;
    this.version = version || null;

    this.methods.forEach(this.generateMethod, this);
  }

  /**
   * Поднять кубик
   * @param  {Object} dependencies зависимости
   */
  up({ config }) {
    this.config = config;

    const options = this.config.get(this.name);

    this.token = this.token || options.token || null;
    this.host = this.host || options.host || DEFAULT_HOST;
    this.version = this.version || options.version || DEFAULT_VERSION;
  }

  getUrl({ path, params, host }) {
    if (!host) host = this.host;
    if (!host) throw new TypeError('host is not defined');

    if (!params) params = {};
    if (params.companyId) path = path.replace('{{companyId}}', params.companyId);
    if (params.conversationId) path = path.replace('{{conversationId}}', params.conversationId);

    return `${host}p1/${path}`;
  }

  /**
   * Сделать запрос к API Viber
   * @param  {String} name  имя метода
   * @param  {Object|String} body тело запроса
   * @param  {Object} params Параметры для url
   * @param  {String} [token=this.token] токен для запроса
   * @param  {String} [host=this.host] хост API Viber
   * @return {Promise<Object>} ответ от Pact API
   */
  async request({ path, body, params, token, host }) {
    const url = this.getUrl({ path, params, host });
    let method = 'GET';

    if (!token) token = this.token;
    const headers = { 'X-Private-Api-Token': token };

    if (isObject(body)) {
      body = querystring.stringify(body);
      headers['content-type'] = 'application/x-www-form-urlencoded'
    }

    if (body) method = 'POST';

    const request = await fetch(url, { method, body, headers });
    const result = await request.json();

    if (result.status === 'errored') {
      throw new PactError(`${get(result, 'errors.0.code')} ${get(result, 'errors.0.description')}`);
    }

    return result;
  }

  /**
   * Сгенерировать метод API
   *
   * Создает функцию для запроса к API, привязывает ее к текущему контексту
   * и кладет в семантичное имя внутри this.
   * В итоге он разбирет путь на части, и раскладывает его по семантичным объектам:
   * one/two/three -> this.one.two.three(currency, body, id);
   * @param  {String}  path путь запроса, без ведущего /: one/two/three
   */
  generateMethod({ kubikName, apiName }) {
    const method = (options) => {
      if (!options) options = {};
      const { params, body, token, host } = options;
      return this.request({ path: apiName, body, params, token, host });
    };
    set(this, kubikName, method);
  }
}

// Чтобы не создавать при каждой инициализации класса,
// пишем значения имени и зависимостей в протип
Pact.prototype.dependencies = Object.freeze(['config']);
Pact.prototype.methods = Object.freeze(methods);
Pact.prototype.name = 'pact';

module.exports = Pact;
