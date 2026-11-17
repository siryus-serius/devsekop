import { getAllDiplomas, getDiplomaBySerial, saveOrUpdateDiploma } from "@/lib/store";
import type { DiplomaRegistry } from "./types";

/** Volatile in-process registry — for local development only. */
export const memoryRegistry: DiplomaRegistry = {
  backend: "memory",
  async issue(input) {
    return saveOrUpdateDiploma(input);
  },
  async getBySerial(serialNumber) {
    return getDiplomaBySerial(serialNumber);
  },
  async list() {
    return getAllDiplomas();
  },
};
