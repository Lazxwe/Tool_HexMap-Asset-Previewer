import { describe, it, expect } from "vitest";
import { TerrainDefinition } from "../../../src/domain/terrain/TerrainDefinition";
import { TerrainId } from "../../../src/domain/terrain/TerrainId";
import { TerrainRegistry } from "../../../src/domain/terrain/TerrainRegistry";

describe("TerrainRegistry", () => {
  it("should register and retrieve terrain definitions", () => {
    const registry = new TerrainRegistry();
    const grass = new TerrainDefinition({ id: "grass", displayName: "Grass" });
    const water = new TerrainDefinition({ id: "water", displayName: "Water" });

    registry.register(grass);
    registry.register(water);

    expect(registry.size).toBe(2);
    expect(registry.has("grass")).toBe(true);
    expect(registry.has(new TerrainId("water"))).toBe(true);
    expect(registry.has("mountain")).toBe(false);

    expect(registry.get("grass")).toBe(grass);
    expect(registry.get(new TerrainId("water"))).toBe(water);
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("should reject duplicate registrations", () => {
    const registry = new TerrainRegistry();
    const t1 = new TerrainDefinition({ id: "forest", displayName: "Forest" });
    const t2 = new TerrainDefinition({ id: "forest", displayName: "Another Forest" });

    registry.register(t1);
    expect(() => registry.register(t2)).toThrow(/already registered/);
  });

  it("should support removing terrain definitions", () => {
    const registry = new TerrainRegistry();
    const sand = new TerrainDefinition({ id: "sand", displayName: "Sand" });
    registry.register(sand);

    expect(registry.has("sand")).toBe(true);
    expect(registry.remove("sand")).toBe(true);
    expect(registry.has("sand")).toBe(false);
    expect(registry.remove("sand")).toBe(false);
  });

  it("should list definitions in deterministic order", () => {
    const registry = new TerrainRegistry();
    const d1 = new TerrainDefinition({ id: "a_grass", displayName: "Grass" });
    const d2 = new TerrainDefinition({ id: "b_mountain", displayName: "Mountain" });
    const d3 = new TerrainDefinition({ id: "c_water", displayName: "Water" });

    registry.register(d1);
    registry.register(d2);
    registry.register(d3);

    const list = registry.list();
    expect(list).toHaveLength(3);
    expect(list[0].id.value).toBe("a_grass");
    expect(list[1].id.value).toBe("b_mountain");
    expect(list[2].id.value).toBe("c_water");
  });

  it("should protect internal state from external mutation", () => {
    const registry = new TerrainRegistry();
    const d1 = new TerrainDefinition({ id: "grass", displayName: "Grass" });
    registry.register(d1);

    const list = registry.list();
    list.pop(); // mutates the returned array

    expect(registry.size).toBe(1);
    expect(registry.list()).toHaveLength(1);
  });

  it("should support clear", () => {
    const registry = new TerrainRegistry();
    registry.register(new TerrainDefinition({ id: "t1", displayName: "T1" }));
    registry.register(new TerrainDefinition({ id: "t2", displayName: "T2" }));

    expect(registry.size).toBe(2);
    registry.clear();
    expect(registry.size).toBe(0);
    expect(registry.list()).toHaveLength(0);
  });
});
