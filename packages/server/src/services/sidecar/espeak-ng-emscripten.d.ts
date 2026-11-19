// eSpeak NG compiled to JavaScript (Echogarden's build, GPL-3.0); it ships no types of its own.
declare module "@echogarden/espeak-ng-emscripten" {
  const createEspeak: () => Promise<unknown>;
  export default createEspeak;
}
