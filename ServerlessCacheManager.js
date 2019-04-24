const AWS = require("aws-sdk");

/**
 * Class ServerlessCacheManager
 */
const ServerlessCacheManager = class ServerlessCacheManager{
    /**
     * @param {json} context - AWS Lambda context
     * @example 
     * const ServerlessCacheManager = require("aws-lambda-serverless-cache").ServerlessCacheManager;
     * exports.handler = async (event, context)=>{
     *      const sCache = new ServerlessCacheManager(context);
     * };     
    */
    constructor(context){
        this.funcName = context.functionName;
        this.localC = {};
        this.lambda = new AWS.Lambda();
    };
    /**
     * This method returns a boolean that says if specified key exists in cache
     * @param {string} key - String key to validate     
     * @returns {boolean}
     * @example 
     * const has = await ServerlessCacheManager.has("doniayape");
     * console.log("Result: ", has); //Result: true|false
    */
    async has(key){
        const val = await this.getValue(key);
        return val !== undefined;
    };
    /**
     * This method returns value from key, else returns undefined
     * @param {string} key - String key to find
     * @returns {string}
     * @example 
     * await ServerlessCacheManager.putValue("doniayape", "Zazi");
     * const value = await ServerlessCacheManager.getValue("doniayape");
     * console.log("Result: ", value); //Result: Zazi
    */
    async getValue(key){
        const val = this.localC["cache_"+key] ? this.localC["cache_"+key] : process.env["cache_"+key];
        const ttl = this.localC["cache_ttl_"+key] ? this.localC["cache_ttl_"+key] : process.env["cache_ttl_"+key];
        if( val ){
            if( ttl && ttl.split(":").length === 2 ){
                const spl = ttl.split(":");
                const now = new Date().getTime() - parseInt(spl[0]);
                if( now > parseInt(spl[1]) ){
                    await this.removeKey(key);
                    return undefined;
                }
            }
        }
        return val;
    };
    /**
     * This method put bulks key/value in cache with optional ttl in milliseconds.
     * @param {Array} kvArray - Array of elements {key: "", value: "", options: {ttl: 0}} to put in cache
     * @example 
     * await ServerlessCacheManager.putValues([
     *  {
     *      key: "doniayape", 
     *      value: "Zazi"
     *  },
     *  {
     *      key: "bar", 
     *      value: "foo",
     *      options: {
     *          ttl: 20000
     *      }
     *  }
     * ]);
    */
    async putValues(kvArray){
        kvArray.forEach((kv)=>{
            this.localC["cache_"+kv.key] = kv.value;
            if( kv.options && kv.options.ttl ){
                this.localC["cache_ttl_"+kv.key] = (new Date().getTime())+":"+kv.options.ttl;
            }
        });
        let current = await this.lambda.getFunctionConfiguration({FunctionName: this.funcName}).promise();        
        const _new = Object.assign(current.Environment && current.Environment.Variables ? current.Environment.Variables : {}, this.localC);
        await this.lambda.updateFunctionConfiguration({FunctionName: this.funcName, Environment: {Variables: _new}}).promise();
    };
    /**
     * This method put key/value in cache with optional ttl in milliseconds.
     * @param {string} key - String with key
     * @param {string} value - String with value of key
     * @param {json} options - JSON with ttl property with ttl in milliseconds
     * @example 
     * await ServerlessCacheManager.putValue("bar", "foo", 
     *  {
     *      ttl: 20000
     *  }
     * );
     */
    async putValue(key, value, options){
        this.localC["cache_"+key] = value;        
        let current = await this.lambda.getFunctionConfiguration({FunctionName: this.funcName}).promise();
        if( options && options.ttl ){
            this.localC["cache_ttl_"+key] = (new Date().getTime())+":"+options.ttl;
        }
        const _new = Object.assign(current.Environment && current.Environment.Variables ? current.Environment.Variables : {}, this.localC);
        await this.lambda.updateFunctionConfiguration({FunctionName: this.funcName, Environment: {Variables: _new}}).promise();
    };
    /**
     * This method removes a key from cache
     * @param {string} key - String with key     
     * @example 
     * await ServerlessCacheManager.removeKey("bar");
     */
    async removeKey(key){
        delete this.localC["cache_"+key];
        delete process.env["cache_"+key];
        delete this.localC["cache_ttl_"+key];
        delete process.env["cache_ttl_"+key];
        let current = await this.lambda.getFunctionConfiguration({FunctionName: this.funcName}).promise();
        if( current.Environment && current.Environment.Variables ){
            const tempEnvs = current.Environment.Variables;
            delete tempEnvs["cache_"+key];
            delete tempEnvs["cache_ttl_"+key];
            await this.lambda.updateFunctionConfiguration({FunctionName: this.funcName, Environment: {Variables: tempEnvs}}).promise();
        }
    };
    /**
     * This method removes bulks of keys from cache
     * @param {Array} keysArray - String array with keys to remove
     * @example 
     * await ServerlessCacheManager.removeKeys(["bar", "doniayape"]);
    */
    async removeKeys(keysArray){
        const nKeys = [];
        keysArray.forEach((key)=>{
            nKeys.push( "cache_"+key );
            nKeys.push( "cache_ttl_"+key );
            delete this.localC["cache_"+key];
            delete process.env["cache_"+key];
            delete this.localC["cache_ttl_"+key];
            delete process.env["cache_ttl_"+key];
        });
        let current = await this.lambda.getFunctionConfiguration({FunctionName: this.funcName}).promise();
        const _new = {};
        if( current.Environment && current.Environment.Variables ){
            const curr = Object.keys(current.Environment.Variables).forEach((ck)=>{
                if( keysArray.indexOf(ck) < 0 ){
                    _new[ck] = current.Environment.Variables[ck];
                }
            });
            await this.lambda.updateFunctionConfiguration({FunctionName: this.funcName, Environment: {Variables: _new}}).promise();
        }
    };
    /**
     * This method gets Time To Live from key
     * @param {string} key - String key to query ttl
     * @example 
     * const ttl ServerlessCacheManager.getKeyTTL("bar");
     * console.log(ttl); //TTL in miliseconds
    */
    getKeyTTL(key){
        const ttl = this.localC["cache_ttl_"+key] ? this.localC["cache_ttl_"+key] : process.env["cache_ttl_"+key];
        return ttl ? Number(ttl.split(":")[1]) : undefined;
    };
    /**
     * This method gets an estimated size in bytes of cache, aws lambda have size limits for k/v saved in env vars (4KB). [AWS Lambda Limits]{@link https://docs.aws.amazon.com/lambda/latest/dg/limits.html}
     * @param {string} key - String key to query ttl
     * @example 
     * const ttl ServerlessCacheManager.getKeyTTL("bar");
     * console.log(ttl); //TTL in miliseconds
    */
    async getCacheSize(){
        let current = await this.lambda.getFunctionConfiguration({FunctionName: this.funcName}).promise();
        return Buffer.byteLength( (current.Environment && current.Environment.Variables ? JSON.stringify(current.Environment.Variables) : "{}", 'utf8') );
    };
};
module.exports.ServerlessCacheManager = ServerlessCacheManager;