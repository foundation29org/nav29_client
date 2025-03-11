import { RouteInfo } from '../vertical-menu/vertical-menu.metadata';

export const HROUTES: RouteInfo[] = [
  {
    path: '/home', title: 'menu.Dashboard', icon: 'ft-home', class: '', isExternalLink: false, submenu: []
  },
  {
    path: '', title: 'epa', icon: 'fas fa-microscope', class: 'has-sub', isExternalLink: false,
    submenu: [
      { path: '/calendar', title: 'menu.Calendar', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
      { path: '/seizures', title: 'menu.Seizures', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
      { path: '/feel', title: 'My disease burden', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
      { path: '/medication', title: 'Medication', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
      { path: '/symptoms', title: 'menu.Phenotype', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
      { path: '/medical-records', title: 'menu.My documents', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
      { path: '/prom', title: 'menu.Questionnaire', icon: 'ft-arrow-right submenu-icon', class: '', isExternalLink: false, submenu: [] },
    ]
  },
  {
    path: '/mydata', title: 'mydata.title', icon: 'ft-layout', class: '', isExternalLink: false, submenu: []
  },
  {
    path: '', title: 'navbar.User Settings', icon: 'fa fa-user', class: 'has-sub', isExternalLink: false,
    submenu:  [
      { path: '/pages/profile', title: 'profile.Settings', icon: 'ft-edit', class: '', isExternalLink: false, submenu: [] },
      { path: '/pages/support', title: 'support.support', icon: 'ft-mail', class: '', isExternalLink: false, submenu: [] },
      { path: '/privacy-policy', title: 'menu.Privacy Policy', icon: 'ft-shield', class: '', isExternalLink: false, submenu: [] },
      { path: '/pages/support', title: 'navbar.Logout', icon: 'ft-power', class: '', isExternalLink: false, submenu: [] }
    ]
  }
];
