import './styles.css';
import { mountApp } from './ui/app';

const root = document.querySelector('#app');
if (root instanceof HTMLElement) {
  mountApp(root);
}
