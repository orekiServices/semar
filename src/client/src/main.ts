import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router/index.js';
import './assets/main.css';

// Register am-lyrics Web Component
import '@uimaxbai/am-lyrics/am-lyrics.js';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
