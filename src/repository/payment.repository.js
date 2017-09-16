  //PAYMENT SERVICE
  const makePurchase = (payment) => {
    return new Promise((resolve, reject) => {
      // const {stripe} = container.cradle
      const container = createContainer()
      container.register({
        stripe: asValue(stripe(stripeSettings.secret))
      })

      container.cradle.stripe.charges.create({
        amount: Math.ceil(payment.amount * 100),
        currency: payment.currency,
        source: {
          number: payment.number,
          cvc: payment.cvc,
          exp_month: payment.exp_month,
          exp_year: payment.exp_year
        },
        description: payment.description
      }, (err, charge) => {
        if (err && err.type === 'StripeCardError') {
          reject(new Error('An error occuered procesing payment with stripe, err: ' + err))
        } else {
          const paid = Object.assign({}, {user: payment.userName, amount: payment.amount, charge})
          resolve(paid)
        }
      })
    })
  }

  const registerPurchase = (payment) => {
    return new Promise((resolve, reject) => {
      makePurchase(payment)
        .then(paid => {
          db.collection('payments').insertOne(paid, (err, result) => {
            if (err) {
              reject(new Error('an error occuered registring payment at db, err:' + err))
            }
            resolve(paid)
          })
        })
        .catch(err => reject(err))
    })
  }

  const getPurchaseById = (paymentId) => {
    return new Promise((resolve, reject) => {
      const response = (err, payment) => {
        if (err) {
          reject(new Error('An error occuered retrieving a order, err: ' + err))
        }
        resolve(payment)
      }
      db.collection('payments').findOne({'charge.id': paymentId}, {}, response)
    })
  }
module.exports = Object.assign({}, {getPurchaseById, registerPurchase, makePurchase})