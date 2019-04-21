const AWS = require('aws-sdk-mock');
const expect = require('chai').expect;
AWS.mock('Lambda', 'updateFunctionConfiguration', '200 Ok');
AWS.mock('Lambda', 'getFunctionConfiguration', function (params, callback){
    callback(null, {
        Environment:{
            Variables:{
                "cache_myKey": "myValue"
            }
        }
    });
});
const AWSLambdaServerlessCacheManager = require("./../index").AWSLambdaServerlessCacheManager;

describe('Serverless cache test suite', ()=>{
    it("Test getValue(\"bar\") = \"foo\"", async ()=>{
        process.env["cache_bar"] = "foo";
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        const value = await serverlessCache.getValue("bar");
        expect(value).to.be.a('string').to.be.eql("foo");        
    });
    it("Test putValue(\"myKey\", \"myValue 1\")", async ()=>{
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        await serverlessCache.putValue("myKey", "myValue");
        const value = await serverlessCache.getValue("myKey");
        expect(value).to.be.a('string').to.be.eql("myValue");        
    });
    it("Test removeKey(\"myKey\")", async ()=>{
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        await serverlessCache.putValue("myKey", "myValue");
        let value = await serverlessCache.getValue("myKey");
        expect(value).to.be.a('string').to.be.eql("myValue"); 
        await serverlessCache.removeKey("myKey");
        value = await serverlessCache.getValue("myKey");
        expect(value).to.be.eql(undefined); 
    });
    it("Test has(\"myKey\")", async ()=>{
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        let has = serverlessCache.has("myKey");
        expect(has).to.be.eql(false);
        await serverlessCache.putValue("myKey", "myValue");
        has = serverlessCache.has("myKey");
        expect(has).to.be.eql(true);        
    });
    it("Test putValue(\"myKey2\", \"myValue2\", 50000) with TTL", async ()=>{
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        await serverlessCache.putValue("myKey2", "myValue2", {ttl: 50000});
        const ttl = serverlessCache.getKeyTTL("myKey2");
        expect(ttl).to.be.eql(50000);
    });
    it("Test putValues([.....])", async ()=>{
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        await serverlessCache.putValues([
            {
                key: "aws",
                value: "lambda"                
            },
            {
                key: "rampi",
                value: "santi",
                options:{
                    ttl: 20000
                }
            }
        ]);
        const ttl = serverlessCache.getKeyTTL("rampi");
        expect(ttl).to.be.eql(20000);
        const awsValue = await serverlessCache.getValue("aws");
        expect(awsValue).to.be.eql("lambda");
        const rampiValue = await serverlessCache.getValue("rampi");
        expect(rampiValue).to.be.eql("santi");
    });
    it("Test getCacheSize()", async ()=>{
        const serverlessCache = new AWSLambdaServerlessCacheManager({
            functionName: "test-function"
        });
        const size = await serverlessCache.getCacheSize();
        expect(size).to.be.eql(4);
    });
});