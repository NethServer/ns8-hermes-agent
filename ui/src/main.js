//
// Copyright (C) 2023 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
//
import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import store from "./store";

import CarbonComponentsVue from "@carbon/vue";
Vue.use(CarbonComponentsVue);

import axios from "axios";
axios.defaults.timeout = 10000;
import VueAxios from "vue-axios";
Vue.use(VueAxios, axios);

import ns8Lib from "@nethserver/ns8-ui-lib";
Vue.use(ns8Lib);

import VueDateFns from "vue-date-fns";
Vue.use(VueDateFns);

import LottieAnimation from "lottie-web-vue";
Vue.use(LottieAnimation);

import vueDebounce from "vue-debounce";
Vue.use(vueDebounce);

// filters
import { Filters } from "@nethserver/ns8-ui-lib";
for (const f in Filters) {
  Vue.filter(f, Filters[f]);
}

Vue.config.productionTip = false;

// i18n
import VueI18n from "vue-i18n";
import { loadLanguage } from "./i18n";

loadI18n();

async function loadI18n() {
  const navigatorLang = navigator.language.substring(0, 2);
  const messages = await loadLanguage(navigatorLang);
  Vue.use(VueI18n);
  // Several translations are partial; without a fallback locale vue-i18n
  // renders the raw key path (e.g. "settings.role_unknown") to the user.
  const i18n = new VueI18n({ fallbackLocale: "en", silentFallbackWarn: true });
  if (navigatorLang !== "en") {
    const englishMessages = await loadLanguage("en");
    i18n.setLocaleMessage("en", englishMessages.default);
  }
  i18n.setLocaleMessage(navigatorLang, messages.default);
  i18n.locale = navigatorLang;

  new Vue({
    router,
    store,
    i18n,
    render: (h) => h(App),
  }).$mount("#ns8-app");
}
