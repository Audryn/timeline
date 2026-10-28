import { accountAction, accountCallback, session } from "./account";
import type { BackendDependencies } from "./core";
import { addPerson, createProject, getProject, listEvents, listProjects, saveEvent } from "./timeline";

export function createBackend(dependencies: BackendDependencies) {
  return {
    session: () => session(dependencies),
    accountAction: (request: Request, action: string) => accountAction(request, action, dependencies),
    accountCallback: (request: Request) => accountCallback(request, dependencies),
    listProjects: () => listProjects(dependencies),
    createProject: (request: Request) => createProject(request, dependencies),
    getProject: (id: string) => getProject(id, dependencies),
    addPerson: (request: Request, id: string) => addPerson(request, id, dependencies),
    listEvents: (request: Request, id: string) => listEvents(request, id, dependencies),
    saveEvent: (request: Request, id: string) => saveEvent(request, id, dependencies),
  };
}
