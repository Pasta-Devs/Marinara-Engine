export type AgentConnectionAssignment = {
  name: string;
  apply: () => Promise<unknown>;
};

export async function settleAgentConnectionAssignments(assignments: AgentConnectionAssignment[]) {
  const results = await Promise.allSettled(assignments.map((assignment) => assignment.apply()));
  return {
    failedNames: assignments
      .filter((_assignment, index) => results[index]?.status === "rejected")
      .map((assignment) => assignment.name),
  };
}
