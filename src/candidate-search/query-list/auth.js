import createDebugLogger from 'debug';
import {toQueries} from '../candidate-search-utils.js';

const debug = createDebugLogger('@natlibfi/melinda-record-matching:candidate-search:query-list:auth');

export function authStandardIdentifiers(record) {
    const a = recordGetAuthIdentifiers(record);

    if (a.length === 0) {
        debug(`No identifiers found, no queries created.`);
        return [];
    }
    return toQueries(a, 'melinda.urx');
}

export function recordGetAuthIdentifiers(record) {
    const f024s = record.get(/024/u);
    if (f024s.length > 0) {
        debug(`${f024s.length} ids found`);
        const values = f024s.map(f => f.subfields).flat().filter(sf => sf.code === 'a').map(sf => sf.value);
        return values;
    }
    return [];
}