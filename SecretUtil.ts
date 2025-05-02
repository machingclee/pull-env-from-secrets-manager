import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import lodash from "lodash";
import * as yaml from 'js-yaml';

export type FileFormat = "yml" | "json"
export type SecretConfig = { awsRegion: string }

export default class SecretUtil {
    private secretConfig: SecretConfig = { awsRegion: "ap-southeast-2" }

    constructor(config: Partial<SecretConfig> = {}) {
        this.secretConfig = { ...this.secretConfig, ...config };
    }

    toTargetFomat(nestedJsonSecret: any, format: FileFormat) {
        if (format === "yml") {
            return this.jsonToYml(nestedJsonSecret);
        }
        else if (format === "json") {
            return JSON.stringify(nestedJsonSecret, null, 4);
        }
        return "{}";
    }

    jsonToYml(nestedJson: any) {
        const ymlString = yaml.dump(nestedJson, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            noCompatMode: true,
            schema: yaml.JSON_SCHEMA
        });
        return ymlString
    }

    async getSecretAsJson(secret_name: string) {
        const client = new SecretsManagerClient({
            region: this.secretConfig.awsRegion,
        });
        let response: GetSecretValueCommandOutput | null = null;

        try {
            response = await client.send(
                new GetSecretValueCommand({ SecretId: secret_name })
            );
        } catch (error) {
            throw error;
        }

        const secret = response.SecretString || "{}";
        const json = JSON.parse(secret);
        const nestedJson: { [key: string]: any } = {}
        Object.entries(json).forEach(([k, v]) => {
            lodash.set(nestedJson, k, v);
        })
        return nestedJson
    }
}

