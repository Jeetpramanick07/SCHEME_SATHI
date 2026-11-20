import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { SimulatedAadhaarQr, SimulatedDigiLocker } from "../../services/prefill-simulated.js";

const SimulatePrefillSchema = z.object({
  age: z.number().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  sex: z.string().optional(),
  district: z.string().optional(),
  // Disallowed/ignored fields if provided by mock clients
  name: z.string().optional(),
  aadhaar_number: z.string().optional(),
  qr_data: z.string().optional(),
  address: z.string().optional(),
});

export const prefillRoutes: FastifyPluginAsync = async (fastify) => {
  const digiLocker = new SimulatedDigiLocker();
  const aadhaarQr = new SimulatedAadhaarQr();

  // POST /prefill/digilocker/simulate
  fastify.post("/prefill/digilocker/simulate", async (request, reply) => {
    if (!config.enableSimulatedPrefill) {
      return reply.status(403).send({
        error: {
          code: "SIMULATED_PREFILL_DISABLED",
          message: "Simulated prefill is disabled by configuration.",
        },
      });
    }

    const body = SimulatePrefillSchema.parse(request.body || {});
    const result = await digiLocker.prefill(body as Record<string, unknown>);
    return result;
  });

  // POST /prefill/aadhaar-qr/simulate
  fastify.post("/prefill/aadhaar-qr/simulate", async (request, reply) => {
    if (!config.enableSimulatedPrefill) {
      return reply.status(403).send({
        error: {
          code: "SIMULATED_PREFILL_DISABLED",
          message: "Simulated prefill is disabled by configuration.",
        },
      });
    }

    const body = SimulatePrefillSchema.parse(request.body || {});
    const result = await aadhaarQr.prefill(body as Record<string, unknown>);
    return result;
  });
};
