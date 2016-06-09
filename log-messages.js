'use strict';

module.exports = {

    SA101: {
        severity: 'error',
        message: 'Server error',
        httpStatus: 500
    },
    SA102: {
        severity: 'error',
        message: 'Unauthenticated',
        httpStatus: 401
    },
    SA103: {
        severity: 'error',
        message: 'Unauthorized',
        httpStatus: 403
    },
    SA104: {
        severity: 'error',
        message: 'Incorrect API version',
        httpStatus: 400
    },
    SA105: {
        severity: 'error',
        message: 'Incorrect startDate parameter',
        httpStatus: 400
    },
    SA106: {
        severity: 'error',
        message: 'Incorrect endDate parameter',
        httpStatus: 400
    },
    SA107: {
        severity: 'error',
        message: 'No data available at this date',
        httpStatus: 400
    },
    SA108: {
        severity: 'warning',
        message: 'Future endDate is not allowed',
        httpStatus: 400
    },
    SA109: {
        severity: 'error',
        message: 'Invalid dimension',
        httpStatus: 400
    },
    /*SA110: {  //dimension limiting is gone in new versions
        severity: 'error',
        message: 'This combination of dimensions is not allowed',
        httpStatus: 400
    },*/
    SA111: {
        severity: 'warning',
        message: 'The result was cut off to meet the limitation',
        httpStatus: 200
    },
    SA112: {
        severity: 'warning',
        message: 'You have requested too much items, maximum limitation was applied',
        httpStatus: 200
    }

};