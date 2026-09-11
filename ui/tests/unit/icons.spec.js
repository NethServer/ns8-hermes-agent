const Vue = require("vue");

describe("Carbon icons with the embedded Vue runtime", () => {
  test.each(["add", "save", "edit", "trash-can", "play", "stop"])(
    "%s renders a bounded SVG with visible geometry",
    (name) => {
      const module = require(`@carbon/icons-vue/lib/${name}/20`);
      const icon = module.default || module;
      const vm = new Vue({ render: (h) => h(icon) });
      const svg = vm._render();

      // Older Carbon versions mistake Vue 2.7's h() for Vue 3. Their flat
      // SVG attributes disappear, leaving a blank 300x150 icon that pushes
      // menu labels outside the clipped overflow menu.
      expect(svg.tag).toBe("svg");
      expect(svg.data.attrs).toMatchObject({ width: 20, height: 20 });
      expect(svg.data.attrs.viewBox).toBeTruthy();
      expect(
        svg.children.some(
          (child) => child.tag === "path" && child.data.attrs.d,
        ),
      ).toBe(true);
      vm.$destroy();
    },
  );
});
