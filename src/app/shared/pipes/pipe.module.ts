import { NgModule } from '@angular/core';
import {CommonModule} from "@angular/common";

import { FilterPipe } from './filter.pipe';
import { SearchPipe } from './search.pipe';
import { ShortNamePipe } from './short-name.pipe';
import { BytesPipe } from './bytes.pipe';
import { TokensPipe } from './tokens.pipe';

@NgModule({
  declarations:[FilterPipe, SearchPipe, ShortNamePipe, BytesPipe, TokensPipe],
  imports:[CommonModule],
  exports:[FilterPipe, SearchPipe, ShortNamePipe, BytesPipe, TokensPipe]
})

export class PipeModule{}
