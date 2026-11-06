import {
  CreateConnectionModalContent,
  type CreateConnectionModalProps,
} from "./create-connection/CreateConnectionModalContent";

export type { CreateConnectionModalProps };
export type { ServiceId } from "./create-connection/CreateConnectionModalContent";

export function CreateConnectionModal(props: CreateConnectionModalProps) {
  return <CreateConnectionModalContent {...props} />;
}
