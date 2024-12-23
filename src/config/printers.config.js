module.exports = {
    'printer1': {
        name: 'Reception Printer',
        connection_type: 'network',
        ip: process.env.PRINTER1_IP || '192.168.1.101'
    },
    'printer2': {
        name: 'Office Printer',
        connection_type: 'network',
        ip: process.env.PRINTER2_IP || '192.168.1.102'
    }
};