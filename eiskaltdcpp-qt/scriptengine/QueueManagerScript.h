/***************************************************************************
*                                                                         *
*   This program is free software; you can redistribute it and/or modify  *
*   it under the terms of the GNU General Public License as published by  *
*   the Free Software Foundation; either version 3 of the License, or     *
*   (at your option) any later version.                                   *
*                                                                         *
***************************************************************************/

#pragma once

#include <QObject>
#include <QStringList>

#include "dcpp/stdinc.h"
#include "dcpp/DCPlusPlus.h"
#include "dcpp/Singleton.h"
#include "dcpp/QueueManager.h"
#include "dcpp/Client.h"

class QueueManagerScript :
        public QObject,
        public dcpp::Singleton<QueueManagerScript>
{
Q_OBJECT
friend class dcpp::Singleton<QueueManagerScript>;

public Q_SLOTS:
    bool add(const QString& aTarget, quint64 aSize, const QString& root, const QString& aUser, const QString& aHub);

private:
    QueueManagerScript(QObject *parent = 0);
    QueueManagerScript(const QueueManagerScript&) {}
    ~QueueManagerScript();
    QueueManagerScript &operator =(const QueueManagerScript&) { return *this; }

    dcpp::QueueManager *QM;
};
