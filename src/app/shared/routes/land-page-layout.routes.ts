import { Routes } from '@angular/router';

export const Land_Pages_ROUTES: Routes = [
     {
        path: '',
        loadChildren: () => import('../../pages/land/land-page.module').then(m => m.LandPageModule)
    }
];
