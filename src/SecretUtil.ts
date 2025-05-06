import { CreateSecretCommand, DescribeSecretCommand, GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient, UpdateSecretCommand } from "@aws-sdk/client-secrets-manager";
import lodash from "lodash";
import * as yaml from 'js-yaml';
import fs from "fs";
import path from "path";
import ts from "typescript"

export type FileFormat = "yml" | "json" | "flat_env"
export type SecretConfig = { awsRegion: string }

export default class SecretUtil {
    private secretConfig: SecretConfig = { awsRegion: "ap-southeast-2" }
    private client: SecretsManagerClient | null = null;

    constructor(config: Partial<SecretConfig> = {}) {
        this.secretConfig = { ...this.secretConfig, ...config };
    }

    private getSecretsManagerClient() {
        if (!this.client) {
            this.client = new SecretsManagerClient({
                region: this.secretConfig.awsRegion,
            });
        }
        return this.client;
    }

    async uploadSecret(secretName: string, secretString: string) {
        const client = this.getSecretsManagerClient();
        try {
            await client.send(new DescribeSecretCommand({ SecretId: secretName }));

            // Secret exists, update it
            const result = await client.send(new UpdateSecretCommand({
                SecretId: secretName,
                SecretString: secretString
            }));

            console.log(`Secret ${secretName} successfully updated!`);
            return result;
        } catch (error: any) {
            if (error.name === 'ResourceNotFoundException') {
                // Secret doesn't exist, create it
                const result = await client.send(new CreateSecretCommand({
                    Name: secretName,
                    Description: `Configuration for ${secretName}`,
                    SecretString: secretString
                }));

                console.log(`Secret ${secretName} successfully created!`);
                return result;
            } else {
                // Unexpected error
                throw error;
            }
        }
    }

    parseTypeScriptFileToJSON(filePath: string) {
        try {
            // Read the TypeScript file content
            const sourceText = fs.readFileSync(filePath, 'utf8');

            // Parse the TypeScript file to AST
            const sourceFile = ts.createSourceFile(
                path.basename(filePath),
                sourceText,
                ts.ScriptTarget.Latest,
                true
            );

            // Look specifically for the export default statement
            let exportedObject = null;

            function visit(node: any) {
                // Check for export default declaration
                if (node.kind === ts.SyntaxKind.ExportAssignment) {
                    const expression = node.expression;

                    // If the exported value is an object literal, capture it
                    if (expression.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                        try {
                            const objectText = expression.getText(sourceFile);
                            exportedObject = eval(`(${objectText})`);
                        } catch (e) {
                            console.error('Error evaluating exported object:', e);
                        }
                    }
                }

                ts.forEachChild(node, visit);
            }

            visit(sourceFile);

            if (exportedObject) {
                return exportedObject;
            }

            // Fallback: if no export default was found, look for any object literals
            // (but be more selective to avoid capturing nested objects)
            const objects: any[] = [];
            let foundInVariableDeclaration = false;

            function findTopLevelObjects(node: any) {
                // Only look at top-level statements
                if (node.parent === sourceFile) {
                    // If it's a variable declaration with object literal initialization
                    if (node.kind === ts.SyntaxKind.VariableStatement) {
                        const declarations = node.declarationList.declarations;
                        declarations.forEach((declaration: any) => {
                            if (declaration.initializer &&
                                declaration.initializer.kind === ts.SyntaxKind.ObjectLiteralExpression) {
                                try {
                                    const objectText = declaration.initializer.getText(sourceFile);
                                    objects.push(eval(`(${objectText})`));
                                    foundInVariableDeclaration = true;
                                } catch (e) {
                                    console.error('Error evaluating object in variable declaration:', e);
                                }
                            }
                        });
                    }
                }

                // Only recurse if we haven't found any objects in variable declarations yet
                if (!foundInVariableDeclaration) {
                    ts.forEachChild(node, findTopLevelObjects);
                }
            }

            if (objects.length === 0) {
                findTopLevelObjects(sourceFile);
            }

            return objects.length === 1 ? objects[0] : objects.length > 1 ? objects : null;
        } catch (error) {
            console.error('Error parsing TypeScript file:', error);
            return null;
        }
    }

    toTargetFomat(json: { nestedJson: any, flatJson: any }, format: FileFormat) {
        const { flatJson, nestedJson } = json;
        if (format === "yml") {
            return this.jsonToYml(nestedJson);
        }
        else if (format === "json") {
            return JSON.stringify(nestedJson, null, 2);
        }
        else if (format === "flat_env") {
            return Object.entries(flatJson).map(([flatKey, value]) => {
                return `${flatKey}=${value}`
            }).join("\n")
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

    flattenJson(obj: { [key: string]: any }, prefix = '') {
        console.log("this is my object", obj)
        return lodash.reduce(obj, (result: any, value, key) => {
            const newKey = prefix ? `${prefix}.${key}` : key;

            if (lodash.isPlainObject(value)) {
                // If it's a plain object, recurse and flatten
                Object.assign(result, this.flattenJson(value, newKey));
            } else if (lodash.isArray(value)) {
                // If it's an array, join values with comma
                result[newKey] = value.join(',');
            } else {
                // Otherwise use the plain value
                result[newKey] = value;
            }

            return result;
        }, {});
    }


    async getSecretAsJson(secret_name: string) {
        const client = this.getSecretsManagerClient();
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
        const flatJson: { [key: string]: any } = {}
        Object.entries(json).sort(([k1, _], [k2, __]) => {
            return k1.localeCompare(k2)
        }).forEach(([k, v]) => {
            lodash.set(nestedJson, k, v);
            flatJson[k] = v
        })

        return { nestedJson, flatJson }
    }
}

