const AWS = require("aws-sdk");
AWS.config.loadFromPath("../aws-credentials.json");

async function sleep(millis) {
    return new Promise((resolve => setTimeout(() => resolve(), millis)));
}


async function deleteApiGateways(prefix) {
    prefix = prefix.replace(/\./g, "-");

    const apiGateway = new AWS.APIGateway();

    const restApis = await apiGateway.getRestApis({ limit: 500 }).promise();

    for (const restApi of restApis.items) {
        if (restApi.name.startsWith(prefix)) {
            console.log("Deleting API '" + restApi.name + "' with id '" + restApi.id + "'");
            let retry;

            do {
                try {
                    retry = false;
                    await apiGateway.deleteRestApi({ restApiId: restApi.id }).promise();
                } catch (error) {
                    console.log(JSON.stringify(error, null, 2));
                    retry = true;
                    await sleep(60000);
                }
            } while (retry);
        }
    }

}

async function deleteStepFunctions(prefix) {
    prefix = prefix.replace(/\./g, "-");

    const stepFunctions = new AWS.StepFunctions();

    const stateMachines = await stepFunctions.listStateMachines({ maxResults: 500 }).promise();

    for (const stateMachine of stateMachines.stateMachines) {
        if (stateMachine.name.startsWith(prefix)) {
            console.log("Deleting StateMachine: " + stateMachine.name);
            await stepFunctions.deleteStateMachine({ stateMachineArn: stateMachine.stateMachineArn }).promise();
        }
    }

    const activities = await stepFunctions.listActivities({ maxResults: 500 }).promise();

    for (const activity of activities.activities) {
        if (activity.name.startsWith(prefix)) {
            console.log("Deleting Activity: " + activity.name);
            await stepFunctions.deleteActivity({ activityArn: activity.activityArn }).promise();
        }
    }
}

async function deleteLambdas(prefix) {
    prefix = prefix.replace(/\./g, "-");

    const lambda = new AWS.Lambda();

    const functions = await lambda.listFunctions({ MaxItems: 500 }).promise();

    for (const f of functions.Functions) {
        if (f.FunctionName.startsWith(prefix)) {
            console.log("Deleting lambda: " + f.FunctionName);
            await lambda.deleteFunction({ FunctionName: f.FunctionName }).promise();
        }
    }

    const layers = await lambda.listLayers({ MaxItems: 50 }).promise();

    for (const layer of layers.Layers) {
        if (layer.LayerName.startsWith(prefix)) {
            console.log("Deleting lambda layer: " + layer.LayerName);
            await lambda.deleteLayerVersion({
                LayerName: layer.LayerName,
                VersionNumber: layer.LatestMatchingVersion.Version
            }).promise();
        }
    }
}

async function deleteDynamoDB(prefix) {
    prefix = prefix.replace(/\./g, "-");

    const dynamoDB = new AWS.DynamoDB();

    const tables = await dynamoDB.listTables({ Limit: 100 }).promise();

    for (const table of tables.TableNames) {
        if (table.startsWith(prefix)) {
            console.log("Deleting dynamodb table: " + table);
            await dynamoDB.deleteTable({ TableName: table }).promise();
        }
    }
}

async function deleteCognito(prefix) {
    prefix = prefix.replace(/\./g, "-");

    const cognitoIdentity = new AWS.CognitoIdentity();

    const identityPools = await cognitoIdentity.listIdentityPools({ MaxResults: 60 }).promise();

    for (const identityPool of identityPools.IdentityPools) {
        if (identityPool.IdentityPoolName.startsWith(prefix)) {
            console.log("Deleting identity pool: " + identityPool.IdentityPoolName);
            await cognitoIdentity.deleteIdentityPool({ IdentityPoolId: identityPool.IdentityPoolId }).promise();
        }
    }

    const cognitoServiceProvider = new AWS.CognitoIdentityServiceProvider();

    const userPools = await cognitoServiceProvider.listUserPools({ MaxResults: 60 }).promise();

    for (const userPool of userPools.UserPools) {
        if (userPool.Name.startsWith(prefix)) {
            console.log("Deleting user pool:" + userPool.Name);
            await cognitoServiceProvider.deleteUserPool({ UserPoolId: userPool.Id }).promise();
        }
    }
}

async function deleteBuckets(prefix) {
    const s3 = new AWS.S3();

    const buckets = await s3.listBuckets().promise();

    for (const bucket of buckets.Buckets) {
        if (bucket.Name.startsWith(prefix)) {
            let ContinuationToken;
            do {
                const params = {
                    Bucket: bucket.Name,
                    ContinuationToken
                };

                const data = await s3.listObjectsV2(params).promise();
                ContinuationToken = data.NextContinuationToken;

                const Objects = [];
                for (const content of data.Contents) {
                    Objects.push({ Key: content.Key });
                }
                if (Objects.length > 0) {
                    const params2 = {
                        Bucket: bucket.Name,
                        Delete: { Objects }
                    };

                    console.log("Deleting " + Objects.length + " Objects from " + bucket.Name);
                    await s3.deleteObjects(params2).promise();
                }
            } while (ContinuationToken);

            console.log("Deleting bucket: " + bucket.Name);
            await s3.deleteBucket({ Bucket: bucket.Name }).promise();
        }
    }
}

async function deleteRolesAndPolicies(prefix) {
    prefix = prefix.replace(/\./g, "-");

    const iam = new AWS.IAM();

    const roles = await iam.listRoles({ MaxItems: 500 }).promise();
    for (const role of roles.Roles) {
        if (role.RoleName.startsWith(prefix)) {
            const rolePolicies = await iam.listRolePolicies({ MaxItems: 500, RoleName: role.RoleName }).promise();

            for (const rolePolicy of rolePolicies.PolicyNames) {
                console.log("Deleting policy " + rolePolicy + " from role " + role.RoleName);
                await iam.deleteRolePolicy({ PolicyName: rolePolicy, RoleName: role.RoleName}).promise();
            }

            const attachedRolePolicies = await iam.listAttachedRolePolicies({ MaxItems: 500, RoleName: role.RoleName }).promise();

            for (const rolePolicy of attachedRolePolicies.AttachedPolicies) {
                console.log("Detaching policy " + rolePolicy.PolicyName + " from role " + role.RoleName);
                await iam.detachRolePolicy({ PolicyArn: rolePolicy.PolicyArn, RoleName: role.RoleName}).promise();
            }

            console.log("Deleting role: " + role.RoleName);
            await iam.deleteRole({ RoleName: role.RoleName }).promise();
        }
    }

    const policies = await iam.listPolicies({ MaxItems: 500 }).promise();
    for (const policy of policies.Policies) {
        if (policy.PolicyName.startsWith(prefix)) {
            console.log("Deleting policy: " + policy.PolicyName);
            await iam.deletePolicy({ PolicyArn: policy.Arn }).promise();
        }
    }


}

async function main() {
    const prefix = "ch.ebu";

    await deleteRolesAndPolicies(prefix);

    // await deleteBuckets(prefix);

    await deleteCognito(prefix);

    await deleteDynamoDB(prefix);

    await deleteLambdas(prefix);

    await deleteStepFunctions(prefix);

    await deleteApiGateways(prefix);
}

main().then(() => console.log("Done")).catch(e => console.error(e));
