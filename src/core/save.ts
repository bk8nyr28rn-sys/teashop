import { mergeConfig } from './config';
import { Rng } from './rng';
import type { Heir, House, SnatchProposal, Thread, World } from './types';

/** 存档格式的版本号。改了数据结构就加一，读档时据此迁移或拒绝 */
export const SAVE_VERSION = 1;

interface SaveData {
  version: number;
  hour: number;
  nextId: number;
  rngState: number;
  config: World['config'];
  houses: House[];
  threads: Thread[];
  threadsByHouse: [string, string[]][];
  heirs: Heir[];
  snatchProposals: SnatchProposal[];
  snatchCooldowns: [string, number][];
}

/** 把世界存成 JSON 字符串（事件和监听器不存） */
export function serializeWorld(world: World): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    hour: world.hour,
    nextId: world.nextId,
    rngState: world.rng.getState(),
    config: world.config,
    houses: [...world.houses.values()],
    threads: [...world.threads.values()],
    threadsByHouse: [...world.threadsByHouse.entries()],
    heirs: [...world.heirs.values()],
    snatchProposals: [...world.snatchProposals.values()],
    snatchCooldowns: [...world.snatchCooldowns.entries()],
  };
  return JSON.stringify(data);
}

/** 从 JSON 字符串读档。版本不对时抛错，由调用方决定是否开新档 */
export function deserializeWorld(json: string): World {
  const data = JSON.parse(json) as SaveData;
  if (data.version !== SAVE_VERSION) throw new Error(`存档版本 ${data.version} 不兼容（当前 ${SAVE_VERSION}）`);
  const rng = new Rng(1);
  rng.setState(data.rngState);
  return {
    hour: data.hour,
    houses: new Map(data.houses.map((h) => [h.id, h])),
    threads: new Map(data.threads.map((t) => [t.id, t])),
    threadsByHouse: new Map(data.threadsByHouse),
    heirs: new Map(data.heirs.map((h) => [h.id, h])),
    snatchProposals: new Map(data.snatchProposals.map((p) => [p.id, p])),
    snatchCooldowns: new Map(data.snatchCooldowns),
    // 用当前默认值补上存档之后新加的配置项
    config: mergeConfig(data.config as never),
    rng,
    events: [],
    recordEvents: false,
    listener: null,
    nextId: data.nextId,
  };
}
