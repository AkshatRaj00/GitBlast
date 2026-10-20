/**
 * GitBlast Autonomous Cross-Repository Ripple Bridge
 * Resolves contract drifts across microservices (Backend, Frontend, SDKs, Contracts).
 */

export interface RemoteServiceContract {
  serviceId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  exportedSchema: string[];
}

export interface CrossRepoRupture {
  sourceService: string;
  targetService: string;
  brokenConsumerModule: string;
  missingContractProperty: string;
}

export class CrossRepoRippleEngine {
  public static auditMicroserviceParity(
    mutatedEndpoints: string[],
    clientConsumers: Array<{ file: string; calledEndpoint: string; expectedFields: string[] }>,
    availableContracts: RemoteServiceContract[]
  ): CrossRepoRupture[] {
    const ruptures: CrossRepoRupture[] = [];

    clientConsumers.forEach((client) => {
      const isTargeted = mutatedEndpoints.includes(client.calledEndpoint);
      if (isTargeted) {
        const matchingContract = availableContracts.find((c) => c.endpoint === client.calledEndpoint);
        if (matchingContract) {
          client.expectedFields.forEach((field) => {
            if (!matchingContract.exportedSchema.includes(field)) {
              ruptures.push({
                sourceService: matchingContract.serviceId,
                targetService: 'ClientApp',
                brokenConsumerModule: client.file,
                missingContractProperty: field,
              });
            }
          });
        }
      }
    });

    return ruptures;
  }
}
