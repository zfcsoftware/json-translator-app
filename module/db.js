
var Datastore = require('nedb')
db = new Datastore({ filename: 'data/db', autoload: true });


const add = (doc) => {
    return new Promise(async (resolve, reject) => {
        doc.created = Date.now()
        try {
            db.insert(doc, function (err, newDoc) {
                if (err || !newDoc || newDoc._id.length <= 0) {
                    resolve(false)
                }
                resolve(true)
            });
        } catch (err) {
            console.log(err.message);
            resolve(false)
        }
    })
}

// const filter = ({ type = 'all' }) => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             var filter_data = {}

//             if (type === 'active') {
//                 filter_data = {
//                     status: true
//                 }
//             }
//             if (type === 'deactive') {
//                 filter_data = {}
//             }


//             db.find(filter_data, function (err, docs) {
//                 if (err || !docs) {
//                     resolve(false)
//                 }
//                 var arr = []
//                 if (type === 'all') {
//                     arr = docs
//                 } else if (type === 'active') {
//                     var d1 = Date.now()
//                     var fl = docs.filter(el => (el.end_date > d1 && el.start_date <= d1))
//                     arr = fl
//                 } else if (type === 'deactive') {
//                     var d1 = Date.now()
//                     var fl = docs.filter(el => (el.end_date <= d1 || el.status === false))
//                     arr = fl
//                 }
//                 try {
//                     arr.sort((a, b) => {
//                         return b.created - a.created;
//                     });
//                 } catch (err) {
//                     console.log(err);
//                 }
//                 resolve(arr)
//             })


//         } catch (err) {
//             console.log(err.message);
//             resolve(false)
//         }
//     })
// }


const remove = (data) => {
    return new Promise((resolve, reject) => {
        try {
            db.remove(data, {multi: true}, function (err, numRemoved) {
                db.persistence.compactDatafile()
                if (err || !numRemoved) {
                    resolve(false)
                }
                resolve(true)
            });


        } catch (err) {
            console.log(err.message);
            resolve(false)
        }

    })
}

const update = (data1, data2) => {
    return new Promise((resolve, reject) => {
        try {
            db.persistence.compactDatafile()

            db.update(data1, { $set: data2 }, {}, function (err, numReplaced) {
                db.persistence.compactDatafile()
                if (err || !numReplaced) {
                    resolve(false)
                }
                db.persistence.compactDatafile()

                resolve(true)
            });
        } catch (err) {
            console.log(err.message);
            resolve(false)
        }

    })
}


const findOne = (data) => {
    return new Promise((resolve, reject) => {
        try {
            db.findOne(data, function (err, docs) {
                if (err || !docs) {
                    resolve(false)
                }
                resolve(docs)
            });

        } catch (err) {
            console.log(err.message);
            resolve(false)
        }

    })
}
const find = (data) => {
    return new Promise((resolve, reject) => {
        try {
            db.find(data, function (err, docs) {
                if (err || !docs) {
                    resolve(false)
                }
                resolve(docs)
            });

        } catch (err) {
            console.log(err.message);
            resolve(false)
        }

    })
}















db.loadDatabase();



module.exports = {
    add,
    remove,
    update,
    find,
    findOne
}