import {rm} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './process.mjs';
for(const name of ['model','client','runtime','server','admin'])for(const output of ['dist','dist-types'])await rm(join(root,'packages',name,output),{recursive:true,force:true});
