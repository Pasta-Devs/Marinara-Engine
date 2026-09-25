import assert from "node:assert/strict";
import { once } from "node:events";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import type { HapticDeviceCommand } from "../../packages/shared/src/types/haptic.js";
import { hapticService } from "../../packages/server/src/services/haptic/buttplug-service.js";

const serverRequire = createRequire(new URL("../../packages/server/package.json", import.meta.url));
const { WebSocketServer } = createRequire(serverRequire.resolve("buttplug"))("ws");
type Message = Record<string, any>;
const received: Message[] = [];
let rejectSecondOutput = false;
let pendingOutputReply = false;
let stoppedBeforeOutputReply = false;
const feature = (index: number, Output: Record<string, { Value: number[]; Duration?: number[] }>) => ({
  FeatureIndex: index,
  FeatureDescriptor: "Protocol fixture; no physical hardware",
  Input: {},
  Output,
});
const Devices = {
  0: {
    DeviceIndex: 0,
    DeviceName: "Multiple ranges",
    DeviceFeatures: {
      0: feature(0, { Rotate: { Value: [-100, 100] }, Vibrate: { Value: [0, 20] } }),
      1: feature(1, { Rotate: { Value: [-200, 200] }, Vibrate: { Value: [0, 100] } }),
      2: feature(2, { HwPositionWithDuration: { Value: [-100, 100], Duration: [100, 5000] } }),
    },
  },
  1: {
    DeviceIndex: 1,
    DeviceName: "Untimed position",
    DeviceFeatures: { 0: feature(0, { Position: { Value: [-10, 10] } }) },
  },
  2: {
    DeviceIndex: 2,
    DeviceName: "Positive minimum",
    DeviceFeatures: { 0: feature(0, { Temperature: { Value: [10, 100] } }) },
  },
  3: { DeviceIndex: 3, DeviceName: "No output", DeviceFeatures: { 0: feature(0, {}) } },
  4: {
    DeviceIndex: 4,
    DeviceName: "Mixed positive minima",
    DeviceFeatures: {
      0: feature(0, { Vibrate: { Value: [0, 20] } }),
      1: feature(1, { Vibrate: { Value: [20, 100] } }),
    },
  },
};
const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
server.on("connection", (socket: any) => {
  socket.on("message", (data: Buffer) => {
    for (const message of JSON.parse(data.toString()) as Message[]) {
      received.push(message);
      const Id = Object.values(message)[0].Id;
      if (message.StopCmd && pendingOutputReply) stoppedBeforeOutputReply = true;
      if (rejectSecondOutput && message.OutputCmd) {
        if (message.OutputCmd.FeatureIndex === 1) {
          socket.send(JSON.stringify([{ Error: { Id, ErrorCode: 4, ErrorMessage: "Simulated feature failure" } }]));
        } else {
          pendingOutputReply = true;
          setTimeout(() => {
            pendingOutputReply = false;
            socket.send(JSON.stringify([{ Ok: { Id } }]));
          }, 50);
        }
        continue;
      }
      const reply = message.RequestServerInfo
        ? {
            ServerInfo: {
              Id,
              ServerName: "Regression fixture",
              MaxPingTime: 0,
              ProtocolVersionMajor: 4,
              ProtocolVersionMinor: 0,
            },
          }
        : message.RequestDeviceList
          ? { DeviceList: { Id, Devices } }
          : { Ok: { Id } };
      socket.send(JSON.stringify([reply]));
    }
  });
});
await once(server, "listening");
const address = server.address();
assert.ok(address && typeof address !== "string");

async function output(command: HapticDeviceCommand) {
  received.length = 0;
  await hapticService.executeCommand(command);
  return received
    .filter((message) => message.OutputCmd)
    .map(({ OutputCmd }) => ({
      device: OutputCmd.DeviceIndex,
      feature: OutputCmd.FeatureIndex,
      command: OutputCmd.Command,
    }));
}

try {
  await hapticService.connect(`ws://127.0.0.1:${address.port}`);
  assert.equal(hapticService.connected, true);
  assert.deepEqual(
    hapticService.devices.map((device) => device.capabilities),
    [["vibrate", "rotate", "position"], ["position"], ["temperature"], [], ["vibrate"]],
  );
  await hapticService.startScanning();
  assert.equal(hapticService.scanning, true);
  await hapticService.stopScanning();
  assert.equal(hapticService.scanning, false);

  // These are the v4 wire values. v5 .percent(0) would send full reverse instead.
  for (const [intensity, expected] of [
    [0, 0],
    [0.5, 50],
    [1, 100],
    [-1, 0],
    [2, 100],
  ]) {
    assert.deepEqual(
      await output({ deviceIndex: 0, action: "rotate", intensity }),
      [
        { device: 0, feature: 0, command: { Rotate: { Value: expected } } },
        { device: 0, feature: 1, command: { Rotate: { Value: expected! * 2 } } },
      ],
      `signed rotation intensity ${intensity} must retain its direction and magnitude per feature`,
    );
  }
  for (const [intensity, expected, secondExpected] of [
    [0, 0, 0],
    [0.5, 10, 50],
    [0.51, 11, 51],
    [1, 20, 100],
    [2, 20, 100],
  ]) {
    assert.deepEqual(
      await output({ deviceIndex: 0, action: "vibrate", intensity }),
      [
        { device: 0, feature: 0, command: { Vibrate: { Value: expected } } },
        { device: 0, feature: 1, command: { Vibrate: { Value: secondExpected } } },
      ],
      "vibration must retain zero, rounding, and the device's full advertised maximum",
    );
  }
  for (const intensity of [0, 0.5, 1]) {
    assert.deepEqual(await output({ deviceIndex: 0, action: "position", intensity, duration: 2 }), [
      { device: 0, feature: 2, command: { HwPositionWithDuration: { Value: intensity * 100, Duration: 2000 } } },
    ]);
    assert.deepEqual(await output({ deviceIndex: 1, action: "position", intensity }), [
      { device: 1, feature: 0, command: { Position: { Value: intensity * 10 } } },
    ]);
  }
  assert.deepEqual(
    await output({ deviceIndex: 2, action: "temperature", intensity: 0.5 }),
    [{ device: 2, feature: 0, command: { Temperature: { Value: 50 } } }],
    "a nonzero minimum must not shift an existing intensity",
  );

  for (const [command, error] of [
    [{ deviceIndex: 2, action: "temperature", intensity: 0 }, /not in the range/],
    [{ deviceIndex: 0, action: "position", intensity: 0.5, duration: 6 }, /Duration value/],
    [{ deviceIndex: 3, action: "rotate", intensity: 0 }, /No compatible haptic outputs/],
    [{ deviceIndex: 99, action: "vibrate", intensity: 1 }, /No connected haptic devices/],
    [{ deviceIndex: 4, action: "vibrate", intensity: 0.1, duration: 0.05 }, /not in the range/],
    [{ deviceIndex: "all", action: "vibrate", intensity: 0.1, duration: 0.05 }, /not in the range/],
  ] as Array<[HapticDeviceCommand, RegExp]>) {
    received.length = 0;
    await assert.rejects(hapticService.executeCommand(command), error);
    await delay(25);
    assert.equal(received.length, 0, "rejected commands must not reach the device");
  }

  await output({ deviceIndex: 4, action: "vibrate", intensity: 1, duration: 0.1 });
  await assert.rejects(
    hapticService.executeCommand({ deviceIndex: 4, action: "vibrate", intensity: 0.1 }),
    /not in the range/,
  );
  const previousTimerDeadline = Date.now() + 2500;
  while (!received.some((message) => message.StopCmd) && Date.now() < previousTimerDeadline) await delay(10);
  assert.equal(received.at(-1)?.StopCmd?.DeviceIndex, 4, "rejected commands must retain the previous stop timer");

  rejectSecondOutput = true;
  received.length = 0;
  await assert.rejects(
    hapticService.executeCommand({ deviceIndex: 0, action: "vibrate", intensity: 1, duration: 0.05 }),
    /Simulated feature failure/,
  );
  rejectSecondOutput = false;
  assert.equal(received.filter((message) => message.OutputCmd).length, 2);
  assert.equal(received.at(-1)?.StopCmd.DeviceIndex, 0, "partial failure must stop the started features");
  assert.equal(
    stoppedBeforeOutputReply,
    false,
    "stop must follow all output completions so a late output cannot restart it",
  );

  await output({ deviceIndex: 0, action: "stop" });
  assert.equal(received.at(-1)?.StopCmd.DeviceIndex, 0);
  assert.equal(received.at(-1)?.StopCmd.Outputs, true);
  await output({ deviceIndex: 0, action: "vibrate", intensity: 0.5, duration: 0.05 });
  const deadline = Date.now() + 2500;
  while (!received.some((message) => message.StopCmd) && Date.now() < deadline) await delay(10);
  assert.equal(received.at(-1)?.StopCmd.DeviceIndex, 0, "duration must automatically stop output");

  await output({ deviceIndex: 0, action: "rotate", intensity: 0.5, duration: 0.2, pattern: "pulse" });
  await hapticService.stopAll();
  assert.equal(received.at(-1)?.StopCmd.Outputs, true);
  assert.equal(received.at(-1)?.StopCmd.DeviceIndex, undefined, "stop all must address every device");
  const countAfterStop = received.length;
  await delay(400);
  assert.equal(received.length, countAfterStop, "stop all must cancel pending pattern steps and timers");

  await hapticService.disconnect();
  assert.equal(hapticService.connected, false);
  assert.deepEqual(hapticService.devices, []);
  await assert.rejects(
    hapticService.executeCommand({ deviceIndex: 0, action: "vibrate", intensity: 1 }),
    /Not connected/,
  );
} finally {
  await hapticService.disconnect();
  for (const socket of server.clients) socket.terminate();
  await new Promise<void>((resolve, reject) => server.close((error?: Error) => (error ? reject(error) : resolve())));
}
console.log("Haptic v5 protocol, intensity, position, range, discovery, and stop regressions passed.");
