/***************************************************************************
*                                                                         *
*   This program is free software; you can redistribute it and/or modify  *
*   it under the terms of the GNU General Public License as published by  *
*   the Free Software Foundation; either version 3 of the License, or     *
*   (at your option) any later version.                                   *
*                                                                         *
***************************************************************************/

#include "QueueManagerScript.h"
#include "WulforUtil.h"

#include <QDir>
#include <QDebug>
#include <iostream>
 
#include "dcpp/CID.h"
#include "dcpp/User.h"

QueueManagerScript::QueueManagerScript(QObject *parent) :
    QObject(parent)
{
    QM = dcpp::QueueManager::getInstance();

    //QM->addListener(this);
}

QueueManagerScript::~QueueManagerScript() {
    //QM->removeListener(this);
}

bool QueueManagerScript::add(const QString& aTarget, quint64 aSize, const QString& root, const QString& aUser) {
    // hard to get a UserPtr to create a HintedUser, so just ignore aUser for now
    QString path=_q(SETTING(DOWNLOAD_DIRECTORY));
    QString target = path + (path.endsWith(QDir::separator())? QString("") : QDir::separator()) + aTarget;
    try {
      QM->add(_tq(target), aSize, TTHValue(_tq(root)));
    } catch (const Exception &) {
      return false;
    }
    return true;
}
